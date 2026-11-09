/** F-GLB-01/02 ohne parameters.toml: Testvektor aus README.md von Agent 2 (EX-GLB-01). */
import { describe, expect, it } from 'vitest';
import { normal, uniform } from '../src/rng.js';

describe('RNG (F-GLB-01/02)', () => {
  it('reproduziert den Testvektor EX-GLB-01', () => {
    expect(uniform('demo-server', 1, 'berlin/gras', 0)).toBeCloseTo(0.525072, 6);
    expect(normal('demo-server', 1, 'berlin/gras', 0)).toBeCloseTo(-1.191398, 6);
  });

  it('ist zustandslos und liegt in [0, 1)', () => {
    for (let t = 0; t < 1000; t++) {
      const u = uniform('s', t, 'e', 0);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(uniform('s', t, 'e', 0)).toBe(u);
    }
  });
});
