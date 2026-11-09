import { describe, expect, it } from 'vitest';
import { deriveRng, normal, uniform } from '../../src/domain/index.js';
import { golden } from './golden.js';

describe('F-GLB-01 / F-GLB-02 against verify.py', () => {
  it('matches test vector EX-GLB-01 from the game design', () => {
    const ex = golden.examples['EX-GLB-01'] as { U: number; Z: number };
    expect(Number(uniform('demo-server', 1, 'berlin/gras', 0).toFixed(6))).toBe(ex.U);
    expect(Number(normal('demo-server', 1, 'berlin/gras', 0).toFixed(6))).toBe(ex.Z);
    expect(ex).toEqual({ U: 0.525072, Z: -1.191398 }); // values printed in README §3
  });

  it.each(golden.rng.map((r) => [`${r.seed}:${r.tick}:${r.entity}:${r.k}`, r] as const))(
    'uniform is bit-identical to Python for %s',
    (_label, row) => {
      expect(uniform(row.seed, row.tick, row.entity, row.k)).toBe(row.uniform);
    },
  );

  it.each(golden.rng.map((r) => [`${r.seed}:${r.tick}:${r.entity}:${r.k}`, r] as const))(
    'normal matches Python within 4 ULP for %s',
    (_label, row) => {
      // log/cos/sqrt are not guaranteed to be correctly rounded on every platform (V8 vs. libm),
      // so F-GLB-02 may differ in the last bit (TD-013). F-GLB-01 above is exact.
      const z = normal(row.seed, row.tick, row.entity, row.k);
      expect(Math.abs(z - row.normal)).toBeLessThanOrEqual(
        4 * Number.EPSILON * Math.max(1, Math.abs(row.normal)),
      );
    },
  );

  it('returns values in [0, 1)', () => {
    for (let k = 0; k < 2000; k++) {
      const u = uniform('range', 7, 'e', k);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('rejects invalid ticks and indices', () => {
    expect(() => uniform('s', -1, 'e')).toThrow(RangeError);
    expect(() => uniform('s', 1.5, 'e')).toThrow(RangeError);
    expect(() => uniform('s', 1, 'e', -1)).toThrow(RangeError);
    expect(() => normal('s', 1, 'e', 0.5)).toThrow(RangeError);
  });
});

describe('deriveRng stream', () => {
  it('consumes consecutive indices k = 0, 1, 2 …', () => {
    const rng = deriveRng('seed', 3, 'player/1');
    expect([rng.next(), rng.next(), rng.next()]).toEqual(
      [0, 1, 2].map((k) => uniform('seed', 3, 'player/1', k)),
    );
    expect(rng.state()).toBe(3);
  });

  it('can resume from a stored index', () => {
    const a = deriveRng('seed', 3, 'x');
    a.next();
    a.next();
    const b = deriveRng('seed', 3, 'x', a.state());
    expect(b.next()).toBe(a.next());
  });

  it('normal() uses an even/odd index pair as in F-GLB-02', () => {
    const rng = deriveRng('seed', 9, 'fight/1');
    rng.next(); // k = 0 used → next normal uses pair (2, 3) = F-GLB-02 index 1
    expect(rng.normal()).toBe(normal('seed', 9, 'fight/1', 1));
    expect(rng.state()).toBe(4);
  });

  it('is independent of processing order', () => {
    const forward = ['a', 'b', 'c'].map((id) => deriveRng('seed', 7, id).next());
    const backward = ['c', 'b', 'a'].map((id) => deriveRng('seed', 7, id).next()).reverse();
    expect(forward).toEqual(backward);
  });

  it('int() covers the inclusive range and validates its arguments', () => {
    const rng = deriveRng('int', 1, 'e');
    const seen = new Set(Array.from({ length: 1000 }, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rng.int(7, 7)).toBe(7);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('chance() follows "event if U < p" and validates p', () => {
    const rng = deriveRng('chance', 1, 'e');
    expect(Array.from({ length: 100 }, () => rng.chance(0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 100 }, () => rng.chance(1)).every(Boolean)).toBe(true);
    const hits = Array.from({ length: 10_000 }, () => rng.chance(0.3)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(2_700);
    expect(hits).toBeLessThan(3_300);
    expect(() => rng.chance(-0.1)).toThrow(RangeError);
    expect(() => rng.chance(Number.NaN)).toThrow(RangeError);
  });

  it('pick() and shuffle() do not mutate the input', () => {
    const rng = deriveRng('pick', 1, 'e');
    const items = Object.freeze(['a', 'b', 'c', 'd']);
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
    expect([...rng.shuffle(items)].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});
