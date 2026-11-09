/**
 * Deterministic, auditable randomness for game rules – exactly as specified by the game design
 * (docs/game-design/README.md §3) and its reference implementation (tools/verify.py):
 *
 *   F-GLB-01  U(seed, t, e, k) = int64_be(SHA256("seed:t:e:k")[0..8]) / 2^64   ∈ [0, 1)
 *   F-GLB-02  Z = sqrt(-2 ln(1 - U_2k)) · cos(2π · U_2k+1)                     (Box–Muller)
 *
 * There is no global RNG state: every decision hashes (server seed, tick, entity, k). Results
 * are reproducible for support, cheat analysis, replays and the balancing simulation (ADR-012),
 * independent of the order in which entities are processed.
 * Test vector EX-GLB-01: U("demo-server", 1, "berlin/gras", 0) = 0.525072, Z = -1.191398.
 *
 * Not cryptographically secret on its own – the server seed must stay secret.
 */
import { sha256, utf8Bytes } from './sha256.js';

const TWO_POW_64 = 2 ** 64;

function assertTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`invalid tick ${tick}`);
}

function assertIndex(k: number): void {
  if (!Number.isSafeInteger(k) || k < 0) throw new RangeError(`invalid random index k=${k}`);
}

/** F-GLB-01: uniform float in [0, 1). */
export function uniform(seed: string, tick: number, entity: string, k = 0): number {
  assertTick(tick);
  assertIndex(k);
  const digest = sha256(utf8Bytes(`${seed}:${tick}:${entity}:${k}`));
  let x = 0n;
  for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(digest[i] as number);
  // Number(x) rounds to nearest like Python's int/float conversion; dividing by a power of two
  // is exact, so the result matches Python's `int / 2**64` bit for bit.
  return Number(x) / TWO_POW_64;
}

/** F-GLB-02: standard normal value from U_2k and U_2k+1. */
export function normal(seed: string, tick: number, entity: string, k = 0): number {
  assertIndex(k);
  const u1 = uniform(seed, tick, entity, 2 * k);
  const u2 = uniform(seed, tick, entity, 2 * k + 1);
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Convenience stream for one decision context (seed, tick, entity): each call consumes the next
 * index k. Rules that need several random numbers for the same entity use one stream.
 */
export interface Rng {
  /** Next uniform float in [0, 1) (F-GLB-01 with the next k). */
  next(): number;
  /** Next standard normal value (F-GLB-02); consumes two indices. */
  normal(): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Event with probability p happens if U < p (game design README §2). */
  chance(p: number): boolean;
  /** Uniformly chosen element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** New array in random order (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Next unused index k (to persist or resume a stream). */
  state(): number;
}

export function deriveRng(serverSeed: string, tick: number, entityId: string, startK = 0): Rng {
  assertTick(tick);
  assertIndex(startK);
  let k = startK;
  const next = (): number => uniform(serverSeed, tick, entityId, k++);

  return {
    next,
    normal() {
      // F-GLB-02 uses an even/odd index pair; align to the next even index.
      if (k % 2 === 1) k++;
      const z = normal(serverSeed, tick, entityId, k / 2);
      k += 2;
      return z;
    },
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
    state: () => k,
  };
}
