/**
 * Game time model.
 *
 * Game time is counted in ticks. Real (server) time is converted into ticks only via an
 * explicit TickClock, and the current time is always passed in – domain code never reads the
 * system clock. This keeps game time and server time from mixing uncontrolled and makes
 * every time-dependent rule reproducible in tests and the simulation.
 *
 * The tick length comes from the game parameters (Agent 2), never from a code constant.
 */

export interface TickClock {
  /** Server time (Unix ms) at which tick 0 starts. */
  readonly epochMs: number;
  /** Length of one tick in ms. */
  readonly tickLengthMs: number;
}

export function createTickClock(epochMs: number, tickLengthMs: number): TickClock {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) throw new RangeError(`invalid epoch ${epochMs}`);
  if (!Number.isSafeInteger(tickLengthMs) || tickLengthMs <= 0) {
    throw new RangeError(`invalid tick length ${tickLengthMs}`);
  }
  return Object.freeze({ epochMs, tickLengthMs });
}

/** Tick that contains the given server time. Times before the epoch are rejected. */
export function tickAt(clock: TickClock, nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < clock.epochMs) {
    throw new RangeError(`tickAt: time ${nowMs} is before the epoch ${clock.epochMs}`);
  }
  return Math.floor((nowMs - clock.epochMs) / clock.tickLengthMs);
}

/** Server time at which the given tick starts. */
export function tickStartMs(clock: TickClock, tick: number): number {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`invalid tick ${tick}`);
  return clock.epochMs + tick * clock.tickLengthMs;
}

/** Milliseconds until the next tick starts (> 0). */
export function msUntilNextTick(clock: TickClock, nowMs: number): number {
  return tickStartMs(clock, tickAt(clock, nowMs) + 1) - nowMs;
}

/** Number of whole ticks needed to cover a duration (rounded up, minimum 0). */
export function ticksForDuration(clock: TickClock, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError(`invalid duration ${durationMs}`);
  return Math.ceil(durationMs / clock.tickLengthMs);
}

/**
 * Ticks that are due between the last processed tick and now (inclusive range), e.g. after a
 * server restart. Empty when nothing is due. The caller processes them in order, each exactly
 * once (idempotency via the tick number).
 */
export function dueTicks(clock: TickClock, lastProcessedTick: number | null, nowMs: number): number[] {
  const current = tickAt(clock, nowMs);
  const from = lastProcessedTick === null ? current : lastProcessedTick + 1;
  const due: number[] = [];
  for (let t = from; t <= current; t++) due.push(t);
  return due;
}
