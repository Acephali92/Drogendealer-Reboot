/**
 * Trade rules (docs/game-design/trade.md, F-TRD-01…06, with F-PRF-03 for the trade bonus), T-103.
 * Pure functions, ported 1:1 from docs/game-design/tools/verify.py with the names of
 * sim/src/model/trade.ts (ADR-012). Money results are bigint cents (ADR-019): what the player pays
 * is rounded up, what the player receives is rounded down (money.ts).
 */
import { type MarketMods, priceBounds, priceK } from './economy.js';
import { ceilCt, floorCt, ROUNDING_EPS } from './money.js';
import type { GameParameters } from './parameters/schema.js';

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * ∫_a^b clamp(K · S^−ε, pmin, pmax) dS, piecewise in closed form (part of F-TRD-01/02).
 * Below s_hi the price is capped at pmax, above s_lo it is floored at pmin.
 */
export function priceIntegral(
  eps: number,
  K: number,
  a: number,
  b: number,
  pmin: number,
  pmax: number,
): number {
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

/** Profession bonuses of F-PRF-03 (professions.md); each may have a `<name>_cap`. */
export type ProfessionBonus =
  | 'handel_spread_reduction'
  | 'schmuggel_control_reduction'
  | 'schmuggel_bribe_bonus'
  | 'gewalt_strength_bonus'
  | 'produktion_yield_bonus'
  | 'finanzen_fee_reduction'
  | 'finanzen_risk_reduction';

/** F-PRF-03: Bonus = min(cap, rate · L); without a cap the bonus is unbounded. */
export function bonus(p: GameParameters, name: ProfessionBonus, L: number): number {
  const prf = p.professions as Record<string, unknown>;
  const rate = prf[name] as number;
  const capKey = `${name}_cap`;
  const cap = own(prf, capKey) ? (prf[capKey] as number) : Infinity;
  return Math.min(cap, rate * L);
}

/** F-TRD-03: spread s = s_base · (1 − Bonus_Handel(L)). */
export function spread(p: GameParameters, lHandel = 0): number {
  return p.trade.spread_base * (1 - bonus(p, 'handel_spread_reduction', lHandel));
}

/** Largest allowed buy order: ⌊min(max_trade_share · S, S − S_min)⌋ (trade.md §5, economy.md §6). */
export function maxOrder(p: GameParameters, S: number): number {
  return Math.floor(Math.min(p.trade.max_trade_share * S, S - p.economy.min_stock));
}

/** Market state an order is priced against: stock S, log noise x, active event multipliers. */
export interface TradeMarket {
  readonly S: number;
  readonly x: number;
  readonly mods?: MarketMods;
}

function checkQuantity(q: number): void {
  if (!Number.isSafeInteger(q) || q <= 0) throw new RangeError(`invalid order quantity: ${q}`);
}

/**
 * F-TRD-01: buy cost C = ⌈(1 + s/2) · ∫_{S−q}^{S} P(σ) dσ⌉ with 1 ≤ q ≤ maxOrder(S); new stock S − q.
 * `mods` carries the event multipliers of F-ECO-06 (default 1, identical to verify.py).
 */
export function buyCost(
  p: GameParameters,
  cid: string,
  g: string,
  m: TradeMarket,
  q: number,
  lHandel = 0,
): { cost: bigint; S: number } {
  checkQuantity(q);
  if (q > maxOrder(p, m.S)) throw new RangeError(`order quantity ${q} exceeds the market limit`);
  const [lo, hi] = priceBounds(p, g);
  const integral = priceIntegral(p.economy.elasticity, priceK(p, cid, g, m.x, m.mods), m.S - q, m.S, lo, hi);
  return { cost: ceilCt((1 + spread(p, lHandel) / 2) * integral), S: m.S - q };
}

/** F-TRD-02: sale revenue R = ⌊(1 − s/2) · ∫_{S}^{S+q} P(σ) dσ⌋ with q ≥ 1; new stock S + q. */
export function sellRevenue(
  p: GameParameters,
  cid: string,
  g: string,
  m: TradeMarket,
  q: number,
  lHandel = 0,
): { revenue: bigint; S: number } {
  checkQuantity(q);
  const [lo, hi] = priceBounds(p, g);
  const integral = priceIntegral(p.economy.elasticity, priceK(p, cid, g, m.x, m.mods), m.S, m.S + q, lo, hi);
  return { revenue: floorCt((1 - spread(p, lHandel) / 2) * integral), S: m.S + q };
}

function goodOf(p: GameParameters, g: string) {
  if (!own(p.goods, g)) throw new RangeError(`unknown good: ${g}`);
  return p.goods[g] as GameParameters['goods'][string];
}

/** F-TRD-04: spoilage Q(t) = ⌊Q_0 · (1 − r)^(t − t_0)⌋, evaluated lazily; dt in ticks. */
export function spoiledQuantity(p: GameParameters, q0: number, g: string, dt: number): number {
  return Math.floor(q0 * (1 - goodOf(p, g).spoil_rate) ** dt + ROUNDING_EPS);
}

/** F-TRD-05: heat from trading H ← min(H_max, H + k · V / 100 000 · h_good); V in cents. */
export function tradeHeat(p: GameParameters, H: number, valueCt: bigint | number, g: string): number {
  return Math.min(
    p.heat.max,
    H + ((p.heat.trade_heat_per_keur * Number(valueCt)) / 100_000) * goodOf(p, g).heat,
  );
}

/** F-TRD-06: carrying capacity = backpack + vehicle, in volume units. */
export function carryCapacity(p: GameParameters, vehicle: string | null): number {
  if (vehicle === null) return p.player.backpack_capacity;
  if (!own(p.vehicles, vehicle)) throw new RangeError(`unknown vehicle: ${vehicle}`);
  return p.player.backpack_capacity + (p.vehicles[vehicle] as GameParameters['vehicles'][string]).capacity;
}
