/**
 * Deterministischer Zufall nach Agent 2 (README.md, F-GLB-01/02).
 * Kein globaler Zustand: jeder Wert ergibt sich aus (seed, tick, entity, k).
 */
import { createHash } from 'node:crypto';

const TWO_POW_64 = 2 ** 64;

/** F-GLB-01: U = erste 8 Byte (big-endian) von SHA256("seed:t:e:k") / 2^64, U ∈ [0, 1). */
export function uniform(seed: string, tick: number, entity: string, k = 0): number {
  const h = createHash('sha256').update(`${seed}:${tick}:${entity}:${k}`).digest();
  return Number(h.readBigUInt64BE(0)) / TWO_POW_64;
}

/** F-GLB-02: Box-Muller aus U(2k) und U(2k+1). */
export function normal(seed: string, tick: number, entity: string, k = 0): number {
  const u1 = uniform(seed, tick, entity, 2 * k);
  const u2 = uniform(seed, tick, entity, 2 * k + 1);
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}
