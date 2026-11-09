/**
 * ÜBERGANGS-Formelschicht (ADR-012): Handel nach Agent 2 (trade.md, F-TRD-01…06, F-PRF-03).
 */
import type { Params } from '../params.js';
import { ceilCt, EPS, floorCt, type MarketMods, priceBounds, priceK } from './economy.js';

/** ∫_a^b clamp(K·S^-ε, pmin, pmax) dS, stückweise geschlossen (Teil von F-TRD-01). */
export function priceIntegral(eps: number, K: number, a: number, b: number, pmin: number, pmax: number): number {
  const sHi = (K / pmax) ** (1 / eps);
  const sLo = (K / pmin) ** (1 / eps);
  let total = 0;
  let x0 = a;
  let x1 = Math.min(b, sHi);
  if (x1 > x0) total += pmax * (x1 - x0);
  x0 = Math.max(a, sHi);
  x1 = Math.min(b, sLo);
  if (x1 > x0) {
    if (Math.abs(eps - 1) < 1e-12) total += K * (Math.log(x1) - Math.log(x0));
    else total += (K * (x1 ** (1 - eps) - x0 ** (1 - eps))) / (1 - eps);
  }
  x0 = Math.max(a, sLo);
  x1 = b;
  if (x1 > x0) total += pmin * (x1 - x0);
  return total;
}

/** F-PRF-03: Bonus = min(cap, rate · L). */
export function bonus(p: Params, name: string, L: number): number {
  const rate = p.professions[name];
  if (typeof rate !== 'number') throw new Error(`Unbekannter Bonus: ${name}`);
  const cap = p.professions[`${name}_cap`];
  return Math.min(typeof cap === 'number' ? cap : Infinity, rate * L);
}

/** F-TRD-03: s = s_base · (1 − Bonus_Handel(L)). */
export function spread(p: Params, lHandel = 0): number {
  return p.trade.spread_base * (1 - bonus(p, 'handel_spread_reduction', lHandel));
}

export function maxOrder(p: Params, S: number): number {
  return Math.floor(Math.min(p.trade.max_trade_share * S, S - p.economy.min_stock));
}

export interface MarketState {
  S: number;
  x: number;
  mods?: MarketMods;
}

/** F-TRD-01: C = ⌈(1 + s/2) · ∫_{S−q}^{S} P(σ) dσ⌉; neuer Bestand S − q. */
export function buyCost(p: Params, cid: string, g: string, m: MarketState, q: number, lHandel = 0): { cost: number; S: number } {
  if (!(q > 0 && q <= maxOrder(p, m.S))) throw new Error(`Ordergröße unzulässig: ${q}`);
  const [lo, hi] = priceBounds(p, g);
  const integral = priceIntegral(p.economy.elasticity, priceK(p, cid, g, m.x, m.mods), m.S - q, m.S, lo, hi);
  return { cost: ceilCt((1 + spread(p, lHandel) / 2) * integral), S: m.S - q };
}

/** F-TRD-02: R = ⌊(1 − s/2) · ∫_{S}^{S+q} P(σ) dσ⌋; neuer Bestand S + q. */
export function sellRevenue(p: Params, cid: string, g: string, m: MarketState, q: number, lHandel = 0): { revenue: number; S: number } {
  if (!(q > 0)) throw new Error(`Ordergröße unzulässig: ${q}`);
  const [lo, hi] = priceBounds(p, g);
  const integral = priceIntegral(p.economy.elasticity, priceK(p, cid, g, m.x, m.mods), m.S, m.S + q, lo, hi);
  return { revenue: floorCt((1 - spread(p, lHandel) / 2) * integral), S: m.S + q };
}

/** F-TRD-04: Q(t) = ⌊Q_0 · (1 − r)^(t − t_0)⌋. */
export function spoiledQuantity(p: Params, q0: number, g: string, dt: number): number {
  return Math.floor(q0 * (1 - p.goods[g]!.spoil_rate) ** dt + EPS);
}

/** F-TRD-05: H ← min(H_max, H + k · V/100 000 · h_Ware). */
export function tradeHeat(p: Params, H: number, valueCt: number, g: string): number {
  return Math.min(p.heat.max, H + (p.heat.trade_heat_per_keur * valueCt) / 100_000 * p.goods[g]!.heat);
}

/** F-TRD-06: Kapazität = Rucksack + Fahrzeug. */
export function carryCapacity(p: Params, vehicle: string | null): number {
  return p.player.backpack_capacity + (vehicle ? p.vehicles[vehicle]!.capacity : 0);
}
