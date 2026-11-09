import { describe, expect, it } from 'vitest';
import { createRng, deriveRng, hashSeed, rngFromState } from '../../src/domain/index.js';

const take = (n: number, f: () => number) => Array.from({ length: n }, f);

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('server-seed');
    const b = createRng('server-seed');
    expect(take(100, a.next)).toEqual(take(100, b.next));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(5, createRng('a').next)).not.toEqual(take(5, createRng('b').next));
  });

  it('has a stable sequence across versions (golden values)', () => {
    // If this fails, every replay and simulation result changes: do not "fix" by updating the
    // numbers without agreeing with Agent 6.
    const rng = createRng('golden');
    expect(take(3, () => rng.int(0, 1_000_000))).toEqual([572740, 533538, 531634]);
  });

  it('returns floats in [0, 1) with a roughly uniform distribution', () => {
    const rng = createRng('uniform');
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      buckets[Math.floor(x * 10)]! += 1;
    }
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan(n / 100); // ±10 %
  });

  it('int() covers the inclusive range and validates its arguments', () => {
    const rng = createRng('int');
    const seen = new Set(take(1000, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rng.int(7, 7)).toBe(7);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('chance() respects the edge probabilities and rejects invalid ones', () => {
    const rng = createRng('chance');
    expect(take(100, () => (rng.chance(0) ? 1 : 0)).every((v) => v === 0)).toBe(true);
    expect(take(100, () => (rng.chance(1) ? 1 : 0)).every((v) => v === 1)).toBe(true);
    const hits = take(10_000, () => (rng.chance(0.3) ? 1 : 0)).reduce((s, v) => s + v, 0);
    expect(hits).toBeGreaterThan(2_700);
    expect(hits).toBeLessThan(3_300);
    expect(() => rng.chance(-0.1)).toThrow(RangeError);
    expect(() => rng.chance(1.1)).toThrow(RangeError);
    expect(() => rng.chance(Number.NaN)).toThrow(RangeError);
  });

  it('pick() and shuffle() work without mutating the input', () => {
    const rng = createRng('pick');
    const items = Object.freeze(['a', 'b', 'c', 'd']);
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
    const shuffled = rng.shuffle(items);
    expect([...shuffled].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('can be snapshotted and resumed via state()', () => {
    const rng = createRng('resume');
    rng.next();
    const resumed = rngFromState(rng.state());
    expect(take(20, resumed.next)).toEqual(take(20, rng.next));
  });
});

describe('deriveRng', () => {
  it('gives each (tick, entity) its own reproducible stream', () => {
    expect(deriveRng('s', 1, 'p1').next()).toBe(deriveRng('s', 1, 'p1').next());
    const values = new Set([
      deriveRng('s', 1, 'p1').next(),
      deriveRng('s', 2, 'p1').next(),
      deriveRng('s', 1, 'p2').next(),
      deriveRng('t', 1, 'p1').next(),
    ]);
    expect(values.size).toBe(4);
  });

  it('is independent of processing order', () => {
    const forward = ['a', 'b', 'c'].map((id) => deriveRng('seed', 7, id).next());
    const backward = ['c', 'b', 'a'].map((id) => deriveRng('seed', 7, id).next()).reverse();
    expect(forward).toEqual(backward);
  });

  it('does not collide when separators appear inside the components', () => {
    expect(hashSeed('a|b') === hashSeed('a')).toBe(false);
    expect(deriveRng('a|1', 1, 'b').next()).not.toBe(deriveRng('a', 1, '1|b').next());
  });

  it('rejects invalid ticks', () => {
    expect(() => deriveRng('s', -1, 'p')).toThrow(RangeError);
    expect(() => deriveRng('s', 1.5, 'p')).toThrow(RangeError);
  });
});
