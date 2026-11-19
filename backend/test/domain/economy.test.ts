import { describe, expect, it } from 'vitest';
import {
  applyEventShock,
  demand,
  equilibriumPrice,
  halfLife,
  loc,
  markets,
  marketPrice,
  marketTick,
  type MarketTickState,
  multipliers,
  noiseStep,
  pickEvent,
  priceBounds,
  priceK,
  refStock,
  stockAfter,
  stockStep,
  supplyLevel,
  targetStock,
} from '../../src/domain/index.js';
import { parseGameParameters } from '../../src/config/parameters.js';
import { close, formulas, golden, PARAMETERS_TOML, roundsTo } from './golden.js';

const p = parseGameParameters(PARAMETERS_TOML);
const ex = (id: string) => golden.examples[id] as Record<string, number>;

describe('economy examples (EX-ECO-01…06, verify.py)', () => {
  it('EX-ECO-01: F-ECO-07 equilibrium price', () => {
    const a = equilibriumPrice(p, 'amsterdam', 'gras');
    const m = equilibriumPrice(p, 'muenchen', 'gras');
    expect(roundsTo(a, ex('EX-ECO-01').P_amsterdam, 2)).toBe(true);
    expect(roundsTo(m, ex('EX-ECO-01').P_muenchen, 2)).toBe(true);
    expect(roundsTo(m / a, ex('EX-ECO-01').ratio, 4)).toBe(true);
  });

  it('EX-ECO-02: demand, supply, reference and target stock, price at target', () => {
    const e = ex('EX-ECO-02');
    const st = targetStock(p, 'rotterdam', 'kokain');
    expect(roundsTo(demand(p, 'rotterdam', 'kokain'), e.D, 4)).toBe(true);
    expect(roundsTo(supplyLevel(p, 'rotterdam', 'kokain'), e.A, 4)).toBe(true);
    expect(roundsTo(refStock(p, 'rotterdam', 'kokain'), e.S_ref, 2)).toBe(true);
    expect(roundsTo(st, e.S_target, 2)).toBe(true);
    expect(roundsTo(marketPrice(p, 'rotterdam', 'kokain', st), e.P, 2)).toBe(true);
  });

  it('EX-ECO-03: recovery after a buy (F-ECO-04 closed form)', () => {
    const e = ex('EX-ECO-03');
    const st = targetStock(p, 'rotterdam', 'kokain');
    const s0 = st - 200;
    for (const [t, S, P] of [
      [0, e.S0, e.P0],
      [34, e.S34, e.P34],
      [144, e.S144, e.P144],
    ] as const) {
      const s = stockAfter(p, s0, st, t);
      expect(roundsTo(s, S, 2)).toBe(true);
      expect(roundsTo(marketPrice(p, 'rotterdam', 'kokain', s), P, 2)).toBe(true);
    }
  });

  it('EX-ECO-04: half-life (F-ECO-08)', () => {
    const t = halfLife(p.economy.reversion_rate);
    expect(roundsTo(t, ex('EX-ECO-04').ticks, 2)).toBe(true);
    expect(roundsTo(t / (60 / p.meta.tick_minutes), ex('EX-ECO-04').hours, 2)).toBe(true);
  });

  it('EX-ECO-05: event shock (F-ECO-09)', () => {
    const e = ex('EX-ECO-05');
    const st = targetStock(p, 'berlin', 'gras');
    const s1 = applyEventShock(p, st, 'razzia');
    const p0 = marketPrice(p, 'berlin', 'gras', st);
    const p1 = marketPrice(p, 'berlin', 'gras', s1);
    expect(roundsTo(s1, e.S_after, 2)).toBe(true);
    expect(roundsTo(p0, e.P_before, 2)).toBe(true);
    expect(roundsTo(p1, e.P_after, 2)).toBe(true);
    expect(roundsTo(p1 / p0, e.factor, 4)).toBe(true);
  });

  it('EX-ECO-06: noise step (F-ECO-05)', () => {
    const x1 = noiseStep(p, 0.02, p.goods.gras!.volatility, -1);
    expect(roundsTo(x1, ex('EX-ECO-06').x1, 6)).toBe(true);
    expect(roundsTo(Math.exp(x1), ex('EX-ECO-06').N, 6)).toBe(true);
  });
});

describe('economy formulas against unrounded verify.py values (every market)', () => {
  it(`covers all ${formulas.markets.length} markets of verify.py`, () => {
    expect(markets(p, 'all').map(([c, g]) => `${c}/${g}`)).toEqual(
      formulas.markets.map((m) => `${m.city}/${m.good}`),
    );
  });

  it.each(formulas.markets.map((m) => [`${m.city}/${m.good}`, m] as const))('%s', (_id, m) => {
    const { city: c, good: g } = m;
    expect(close(demand(p, c, g), m.demand)).toBe(true);
    expect(close(supplyLevel(p, c, g), m.supply_level)).toBe(true);
    expect(close(refStock(p, c, g), m.ref_stock)).toBe(true);
    expect(close(targetStock(p, c, g), m.target_stock)).toBe(true);
    expect(close(equilibriumPrice(p, c, g), m.equilibrium_price)).toBe(true);
    expect(close(priceK(p, c, g), m.price_K)).toBe(true);
    for (const [ev, e] of Object.entries(m.events)) {
      const event = p.events[ev]!;
      expect(close(refStock(p, c, g, { demand: event.demand_mult }), e.ref_stock)).toBe(true);
      expect(close(targetStock(p, c, g, { supply: event.supply_mult }), e.target_stock)).toBe(true);
      expect(close(applyEventShock(p, m.target_stock, ev), e.shocked)).toBe(true);
    }
    const [lo, hi] = priceBounds(p, g);
    for (const row of m.prices) {
      const price = marketPrice(p, c, g, row.S, row.x, { demand: row.ev_d });
      expect(close(price, row.price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(lo);
      expect(price).toBeLessThanOrEqual(hi);
    }
  });

  it('stockAfter (F-ECO-04) and stockStep keep S ≥ S_min', () => {
    for (const r of formulas.stock_after)
      expect(close(stockAfter(p, r.S0, r.S_target, r.ticks), r.S)).toBe(true);
    expect(stockStep(p, 1, 0)).toBe(p.economy.min_stock);
    expect(stockStep(p, 100, 200)).toBeCloseTo(100 + p.economy.reversion_rate * 100, 12);
  });

  it('halfLife (F-ECO-08)', () => {
    for (const r of formulas.half_life) expect(close(halfLife(r.lambda), r.ticks)).toBe(true);
  });

  it('keeps the [events] order of parameters.toml (F-ECO-09 depends on it, Python dicts keep it too)', () => {
    // Order of the [events.<key>] tables in the file text (the golden JSON stores keys sorted).
    const fileOrder = [...PARAMETERS_TOML.matchAll(/^\[events\.([a-z0-9_]+)\]/gm)].map((m) => m[1]);
    expect(Object.keys(p.events)).toEqual(fileOrder);
    expect(fileOrder).toEqual(['razzia', 'lieferung', 'party']);
  });

  it('pickEvent (F-ECO-09) uses the [events] order as consecutive intervals', () => {
    for (const r of formulas.pick_event) expect(pickEvent(p, r.u)).toBe(r.event);
    expect(pickEvent(p, 0)).toBe(Object.keys(p.events)[0]);
    expect(pickEvent(p, 0.999999)).toBeNull();
  });

  it('rejects unknown locations, goods, events and non-markets', () => {
    expect(loc(p, 'berlin').realm).toBe('earth');
    expect(loc(p, 'mars').realm).toBe('space');
    expect(() => loc(p, 'atlantis')).toThrow(RangeError);
    expect(() => loc(p, '__proto__')).toThrow(RangeError);
    expect(multipliers(p, 'berlin', 'gras')).toEqual([1, 1]);
    expect(multipliers(p, 'berlin', 'sternenstaub')).toBeNull();
    expect(() => multipliers(p, 'berlin', 'zucker')).toThrow(RangeError);
    expect(() => demand(p, 'berlin', 'sternenstaub')).toThrow(RangeError);
    expect(() => priceBounds(p, 'toString')).toThrow(RangeError);
    expect(() => applyEventShock(p, 100, 'weltuntergang')).toThrow(RangeError);
  });
});

describe('marketTick (economy.md §5)', () => {
  it.each(formulas.ticks.markets.map((m) => [`${m.city}/${m.good}`, m] as const))(
    '%s follows the verify.py trajectory over 3 000 ticks',
    (_id, m) => {
      let state: MarketTickState = { stock: m.initial_stock, noise: 0, activeEvent: null, eventTicksLeft: 0 };
      const byTick = new Map(m.snapshots.map((s) => [s.tick, s]));
      let checked = 0;
      for (let t = 0; t < formulas.ticks.count; t++) {
        const next = marketTick(p, formulas.ticks.seed, t, m.city, m.good, state);
        const snap = byTick.get(t);
        if (snap) {
          // Normal draws differ from Python by ≤ 1 ULP (TD-013) and accumulate over the AR(1) chain.
          expect(close(next.stock, snap.stock, 1e-9)).toBe(true);
          expect(close(next.noise, snap.noise, 1e-9)).toBe(true);
          expect(close(next.price, snap.price, 1e-9)).toBe(true);
          expect(next.activeEvent).toBe(snap.event);
          expect(next.eventTicksLeft).toBe(snap.left);
          checked++;
        }
        state = next;
      }
      expect(checked).toBe(m.snapshots.length);
    },
  );

  it('the golden trajectories contain started and finished events', () => {
    const events = formulas.ticks.markets.flatMap((m) => m.snapshots.map((s) => s.event));
    expect(new Set(events.filter((e) => e !== null)).size).toBe(Object.keys(p.events).length);
  });

  it('is deterministic and starts an event with its stock shock', () => {
    const state: MarketTickState = { stock: 1_000, noise: 0, activeEvent: null, eventTicksLeft: 0 };
    expect(marketTick(p, 's', 7, 'berlin', 'gras', state)).toEqual(
      marketTick(p, 's', 7, 'berlin', 'gras', state),
    );
    const party = p.events.party!;
    const running: MarketTickState = { stock: 1_000, noise: 0, activeEvent: 'party', eventTicksLeft: 2 };
    const t1 = marketTick(p, 's', 7, 'berlin', 'gras', running);
    expect(t1.activeEvent).toBe('party');
    expect(t1.eventTicksLeft).toBe(1);
    const t2 = marketTick(p, 's', 8, 'berlin', 'gras', t1);
    expect(t2.activeEvent).toBeNull();
    expect(t2.eventTicksLeft).toBe(0);
    // The last event tick still prices with M_d of the event.
    expect(t2.price).toBe(
      marketPrice(p, 'berlin', 'gras', t2.stock, t2.noise, { demand: party.demand_mult }),
    );
  });
});
