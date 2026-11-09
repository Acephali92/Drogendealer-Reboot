import { describe, expect, it } from 'vitest';
import {
  createTickClock,
  dueTicks,
  msUntilNextTick,
  tickAt,
  tickStartMs,
  ticksForDuration,
} from '../../src/domain/index.js';

const EPOCH = 1_800_000_000_000;
const clock = createTickClock(EPOCH, 600_000); // tick length is a parameter; 10 min only for this test

describe('tick clock', () => {
  it('maps server time to ticks at the exact boundaries', () => {
    expect(tickAt(clock, EPOCH)).toBe(0);
    expect(tickAt(clock, EPOCH + 599_999)).toBe(0);
    expect(tickAt(clock, EPOCH + 600_000)).toBe(1);
    expect(tickStartMs(clock, 3)).toBe(EPOCH + 1_800_000);
    expect(tickAt(clock, tickStartMs(clock, 42))).toBe(42);
  });

  it('rejects invalid clocks, ticks and times', () => {
    expect(() => createTickClock(EPOCH, 0)).toThrow(RangeError);
    expect(() => createTickClock(EPOCH, 1.5)).toThrow(RangeError);
    expect(() => createTickClock(-1, 1000)).toThrow(RangeError);
    expect(() => tickAt(clock, EPOCH - 1)).toThrow(RangeError);
    expect(() => tickStartMs(clock, -1)).toThrow(RangeError);
  });

  it('computes the remaining time to the next tick', () => {
    expect(msUntilNextTick(clock, EPOCH)).toBe(600_000);
    expect(msUntilNextTick(clock, EPOCH + 599_999)).toBe(1);
  });

  it('rounds durations up to whole ticks', () => {
    expect(ticksForDuration(clock, 0)).toBe(0);
    expect(ticksForDuration(clock, 1)).toBe(1);
    expect(ticksForDuration(clock, 600_000)).toBe(1);
    expect(ticksForDuration(clock, 600_001)).toBe(2);
    expect(() => ticksForDuration(clock, -1)).toThrow(RangeError);
  });
});

describe('dueTicks (catch-up after downtime)', () => {
  it('returns every missed tick exactly once, in order', () => {
    expect(dueTicks(clock, 4, tickStartMs(clock, 7) + 10)).toEqual([5, 6, 7]);
  });

  it('returns nothing when the current tick was already processed', () => {
    expect(dueTicks(clock, 7, tickStartMs(clock, 7) + 10)).toEqual([]);
  });

  it('starts with the current tick when nothing was processed yet', () => {
    expect(dueTicks(clock, null, tickStartMs(clock, 3))).toEqual([3]);
  });
});
