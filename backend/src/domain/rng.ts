/**
 * Deterministic, seedable pseudo random number generator for game rules.
 *
 * - Pure TypeScript, no platform APIs: identical sequences on server, in tests and in the
 *   balancing simulation (ADR-012).
 * - Seeding: cyrb128 string hash → 128-bit state. Generator: sfc32 (Small Fast Counter),
 *   period ≈ 2^128, passes PractRand; NOT cryptographically secure (never use for tokens).
 * - Per-entity streams via deriveRng(serverSeed, tick, entityId), so the order in which
 *   entities are processed does not change their random outcomes.
 */

export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** true with probability p (0 ≤ p ≤ 1). */
  chance(p: number): boolean;
  /** Uniformly chosen element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** New array with the elements in random order (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Snapshot of the internal state, e.g. to persist or replay a stream. */
  state(): RngState;
}

/** cyrb128: fast 128-bit string hash used only for seeding. */
export function hashSeed(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

const WARM_UP_ROUNDS = 15;

/** Creates a generator from an explicit 128-bit state (see Rng.state()). */
export function rngFromState(initial: RngState): Rng {
  let [a, b, c, d] = initial;

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  const next = (): number => nextUint32() / 4294967296;

  const rng: Rng = {
    next,
    int(min, max) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
        throw new RangeError(`Rng.int: invalid range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      if (!(p >= 0 && p <= 1)) throw new RangeError(`Rng.chance: probability ${p} not in [0, 1]`);
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('Rng.pick: empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as (typeof out)[number], out[i] as (typeof out)[number]];
      }
      return out;
    },
    state: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
  return rng;
}

/** Creates a generator from a string seed. Same seed → same sequence, on every platform. */
export function createRng(seed: string): Rng {
  const rng = rngFromState(hashSeed(seed));
  for (let i = 0; i < WARM_UP_ROUNDS; i++) rng.next();
  return rng;
}

/**
 * Independent stream for one entity in one tick: derive(serverSeed, tick, entityId).
 * Components are length-prefixed so that ("a|b", 1, "c") and ("a", 1, "b|c") never collide.
 */
export function deriveRng(serverSeed: string, tick: number, entityId: string): Rng {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`deriveRng: invalid tick ${tick}`);
  return createRng(`${serverSeed.length}:${serverSeed}|${tick}|${entityId.length}:${entityId}`);
}
