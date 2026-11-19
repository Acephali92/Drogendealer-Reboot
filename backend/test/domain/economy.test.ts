import { describe, expect, it } from 'vitest';
import { equilibriumPrice, loc, markets, multipliers } from '../../src/domain/index.js';
import { parseGameParameters } from '../../src/config/parameters.js';
import { golden, PARAMETERS_TOML } from './golden.js';

const p = parseGameParameters(PARAMETERS_TOML);
const r2 = (x: number) => Math.round(x * 100) / 100;

describe('economy (economy.md, same semantics as verify.py)', () => {
  it('F-ECO-07 equilibrium price matches EX-ECO-01', () => {
    const ex = golden.examples['EX-ECO-01'] as { P_amsterdam: number; P_muenchen: number };
    expect(r2(equilibriumPrice(p, 'amsterdam', 'gras'))).toBe(ex.P_amsterdam);
    expect(r2(equilibriumPrice(p, 'muenchen', 'gras'))).toBe(ex.P_muenchen);
  });

  it('resolves earth cities and space locations', () => {
    expect(loc(p, 'berlin').realm).toBe('earth');
    expect(loc(p, 'mars').realm).toBe('space');
    expect(() => loc(p, 'atlantis')).toThrow(RangeError);
    expect(() => loc(p, '__proto__')).toThrow(RangeError);
  });

  it('trades own-realm goods everywhere and foreign goods only where configured', () => {
    expect(multipliers(p, 'berlin', 'gras')).toEqual([1, 1]);
    expect(multipliers(p, 'berlin', 'speed')).toEqual([1.5, 1.4]);
    expect(multipliers(p, 'berlin', 'sternenstaub')).toBeNull();
    expect(() => multipliers(p, 'berlin', 'zucker')).toThrow(RangeError);
  });

  it('lists markets: every earth city trades every earth good', () => {
    const earthGoods = Object.values(p.goods).filter((g) => g.realm === 'earth').length;
    const earthMarkets = markets(p).filter(([cid]) => cid in p.city);
    expect(earthMarkets.length).toBeGreaterThanOrEqual(Object.keys(p.city).length * earthGoods);
    expect(markets(p, 'all').length).toBeGreaterThan(markets(p).length);
  });
});
