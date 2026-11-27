import { describe, expect, it } from 'vitest';
import {
  buyCost,
  carryCapacity,
  maxOrder,
  priceBounds,
  priceIntegral,
  sellRevenue,
  spoiledQuantity,
  spread,
  targetStock,
  tradeHeat,
} from '../../src/domain/index.js';
import { parseGameParameters } from '../../src/config/parameters.js';
import { close, formulas, golden, PARAMETERS_TOML, roundsTo } from './golden.js';

const p = parseGameParameters(PARAMETERS_TOML);
const ex = (id: string) => golden.examples[id] as Record<string, number>;

describe('trade examples (EX-TRD-01…06, verify.py)', () => {
  it('EX-TRD-01: buy cost with price impact (F-TRD-01)', () => {
    const e = ex('EX-TRD-01');
    const { cost, S } = buyCost(
      p,
      'rotterdam',
      'kokain',
      { S: targetStock(p, 'rotterdam', 'kokain'), x: 0 },
      200,
    );
    expect(cost).toBe(BigInt(e.cost!));
    expect(roundsTo(Number(cost) / 200, e.avg, 2)).toBe(true);
    expect(roundsTo(S, e.S_after, 2)).toBe(true);
  });

  it('EX-TRD-02: sale revenue (F-TRD-02)', () => {
    const e = ex('EX-TRD-02');
    const { revenue, S } = sellRevenue(
      p,
      'muenchen',
      'kokain',
      { S: targetStock(p, 'muenchen', 'kokain'), x: 0 },
      200,
    );
    expect(revenue).toBe(BigInt(e.revenue!));
    expect(roundsTo(Number(revenue) / 200, e.avg, 2)).toBe(true);
    expect(roundsTo(S, e.S_after, 2)).toBe(true);
  });

  it('EX-TRD-03: buying and selling back immediately loses money (round trip)', () => {
    const e = ex('EX-TRD-03');
    const st = targetStock(p, 'rotterdam', 'kokain');
    const buy = buyCost(p, 'rotterdam', 'kokain', { S: st, x: 0 }, 200);
    const sell = sellRevenue(p, 'rotterdam', 'kokain', { S: buy.S, x: 0 }, 200);
    expect(buy.cost).toBe(BigInt(e.cost!));
    expect(sell.revenue).toBe(BigInt(e.revenue!));
    expect(buy.cost - sell.revenue).toBe(BigInt(e.loss!));
  });

  it('EX-TRD-04: spoilage (F-TRD-04)', () => {
    expect(spoiledQuantity(p, 100, 'pilze', 144)).toBe(ex('EX-TRD-04').Q_day);
    expect(spoiledQuantity(p, 100, 'pilze', 1008)).toBe(ex('EX-TRD-04').Q_week);
  });

  it('EX-TRD-05: heat from trading (F-TRD-05)', () => {
    expect(roundsTo(tradeHeat(p, 0, BigInt(ex('EX-TRD-01').cost!), 'kokain'), ex('EX-TRD-05').H, 4)).toBe(
      true,
    );
  });

  it('EX-TRD-06: carrying capacity (F-TRD-06)', () => {
    const cap = carryCapacity(p, 'kleinwagen');
    expect(cap).toBe(ex('EX-TRD-06').capacity);
    expect(Math.floor(cap / p.goods.gras!.volume)).toBe(ex('EX-TRD-06').max_gras);
    expect(Math.floor(cap / p.goods.kokain!.volume)).toBe(ex('EX-TRD-06').max_kokain);
  });
});

describe('trade formulas against unrounded verify.py values', () => {
  it.each(formulas.markets.map((m) => [`${m.city}/${m.good}`, m] as const))(
    '%s: buy and sell, exact cents (also during an event with M_d)',
    (_id, m) => {
      expect(maxOrder(p, m.target_stock)).toBe(m.max_order);
      for (const b of m.buy) {
        const r = buyCost(p, m.city, m.good, { S: b.S, x: b.x, mods: { demand: b.ev_d } }, b.q, b.L);
        expect(r.cost).toBe(BigInt(b.cost));
        expect(close(r.S, b.S_after)).toBe(true);
      }
      for (const s of m.sell) {
        const r = sellRevenue(p, m.city, m.good, { S: s.S, x: s.x, mods: { demand: s.ev_d } }, s.q, s.L);
        expect(r.revenue).toBe(BigInt(s.revenue));
        expect(close(r.S, s.S_after)).toBe(true);
      }
    },
  );

  it('priceIntegral covers the pmax, free and pmin sections', () => {
    for (const r of formulas.price_integral) {
      expect(close(priceIntegral(r.eps, r.K, r.a, r.b, r.pmin, r.pmax), r.value)).toBe(true);
    }
  });

  it('spread (F-TRD-03) with the capped trade bonus (F-PRF-03)', () => {
    for (const r of formulas.spread) expect(close(spread(p, r.L), r.spread)).toBe(true);
  });

  it('spoiledQuantity, tradeHeat and carryCapacity for every good and vehicle', () => {
    for (const r of formulas.spoiled_quantity) expect(spoiledQuantity(p, r.q0, r.good, r.dt)).toBe(r.q);
    for (const r of formulas.trade_heat) expect(close(tradeHeat(p, r.H, r.value, r.good), r.heat)).toBe(true);
    for (const r of formulas.carry_capacity) expect(carryCapacity(p, r.vehicle)).toBe(r.capacity);
  });
});

describe('trade edge cases', () => {
  const st = targetStock(p, 'berlin', 'gras');

  it('rejects order sizes outside 1 … maxOrder (buy) and ≥ 1 (sell)', () => {
    const m = { S: st, x: 0 };
    for (const q of [0, -1, 1.5, Number.NaN, Infinity]) {
      expect(() => buyCost(p, 'berlin', 'gras', m, q)).toThrow(RangeError);
      expect(() => sellRevenue(p, 'berlin', 'gras', m, q)).toThrow(RangeError);
    }
    expect(() => buyCost(p, 'berlin', 'gras', m, maxOrder(p, st) + 1)).toThrow(RangeError);
    expect(() => buyCost(p, 'berlin', 'gras', m, maxOrder(p, st))).not.toThrow();
  });

  it('cannot buy from a market at minimum stock', () => {
    expect(maxOrder(p, p.economy.min_stock)).toBeLessThan(1);
    expect(() => buyCost(p, 'berlin', 'gras', { S: p.economy.min_stock, x: 0 }, 1)).toThrow(RangeError);
  });

  it('splitting an order never makes it cheaper (rounding favours the market)', () => {
    const m = { S: st, x: 0 };
    const whole = buyCost(p, 'berlin', 'gras', m, 100).cost;
    let split = 0n;
    let S = st;
    for (let i = 0; i < 100; i++) {
      const r = buyCost(p, 'berlin', 'gras', { S, x: 0 }, 1);
      split += r.cost;
      S = r.S;
    }
    expect(split).toBeGreaterThanOrEqual(whole);
  });

  it('prices every unit within [P_min, P_max] even when buying the market down', () => {
    const [lo, hi] = priceBounds(p, 'gras');
    const q = maxOrder(p, st);
    const { cost } = buyCost(p, 'berlin', 'gras', { S: st, x: 0 }, q);
    expect(Number(cost)).toBeGreaterThanOrEqual(lo * q);
    expect(Number(cost)).toBeLessThanOrEqual(hi * q * (1 + spread(p) / 2) + 1);
  });

  it('an event with M_d > 1 raises the trade price (F-ECO-06 inside F-TRD-01)', () => {
    const plain = buyCost(p, 'berlin', 'gras', { S: st, x: 0 }, 10).cost;
    const party = buyCost(
      p,
      'berlin',
      'gras',
      { S: st, x: 0, mods: { demand: p.events.party!.demand_mult } },
      10,
    ).cost;
    expect(party).toBeGreaterThan(plain);
  });

  it('heat is capped at heat.max; unknown goods and vehicles are rejected', () => {
    expect(tradeHeat(p, p.heat.max, 10n ** 12n, 'kokain')).toBe(p.heat.max);
    expect(() => tradeHeat(p, 0, 1n, 'zucker')).toThrow(RangeError);
    expect(() => spoiledQuantity(p, 1, '__proto__', 1)).toThrow(RangeError);
    expect(() => carryCapacity(p, 'ufo')).toThrow(RangeError);
    expect(carryCapacity(p, null)).toBe(p.player.backpack_capacity);
  });
});
