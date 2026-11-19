/**
 * Economy rules (docs/game-design/economy.md, F-ECO-01…09), T-103.
 * Pure functions, ported 1:1 from docs/game-design/tools/verify.py (reference implementation,
 * Agent 2) with the names of sim/src/model/economy.ts, so the simulation can import them
 * (ADR-012). Intermediate values are float64 like in verify.py; money is rounded to bigint cents
 * only at the end of a formula (money.ts, ADR-019).
 */
import { normal, uniform } from './rng.js';
import type { GameParameters } from './parameters/schema.js';

export type Realm = 'earth' | 'space';

export interface LocationParams {
  readonly name: string;
  readonly pop: number;
  readonly wealth: number;
  readonly police: number;
  readonly fuel_price: bigint;
  readonly supply: Readonly<Record<string, number>>;
  readonly demand: Readonly<Record<string, number>>;
}

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** A location is an earth city ([city.*]) or a space location ([space_location.*]). */
export function loc(p: GameParameters, cid: string): { c: LocationParams; realm: Realm } {
  if (own(p.city, cid)) return { c: p.city[cid] as LocationParams, realm: 'earth' };
  if (own(p.space_location, cid)) return { c: p.space_location[cid] as LocationParams, realm: 'space' };
  throw new RangeError(`unknown location: ${cid}`);
}

/**
 * (m_s, m_d) of a market, or null if the good is not traded there (F-ECO-02): goods of the
 * location's own realm trade everywhere (missing multiplier = 1.0); foreign goods only where they
 * appear in both supply and demand.
 */
export function multipliers(p: GameParameters, cid: string, g: string): [number, number] | null {
  const { c, realm } = loc(p, cid);
  if (!own(p.goods, g)) throw new RangeError(`unknown good: ${g}`);
  const good = p.goods[g] as { realm: Realm };
  const s = own(c.supply, g) ? (c.supply[g] as number) : undefined;
  const d = own(c.demand, g) ? (c.demand[g] as number) : undefined;
  if (good.realm === realm) return [s ?? 1.0, d ?? 1.0];
  if (s !== undefined && d !== undefined) return [s, d];
  return null;
}

/** All (location, good) pairs that form a market. */
export function markets(p: GameParameters, realm: 'earth' | 'all' = 'earth'): Array<[string, string]> {
  const locations =
    realm === 'earth' ? Object.keys(p.city) : [...Object.keys(p.city), ...Object.keys(p.space_location)];
  const out: Array<[string, string]> = [];
  for (const cid of locations) {
    for (const g of Object.keys(p.goods)) if (multipliers(p, cid, g)) out.push([cid, g]);
  }
  return out;
}

/** F-ECO-07: equilibrium price P* = P_base · W^ω · (m_d / m_s)^ε (unclamped, cents as float). */
export function equilibriumPrice(p: GameParameters, cid: string, g: string): number {
  const { c } = loc(p, cid);
  const [ms, md] = marketMultipliers(p, cid, g);
  return (
    Number(good(p, g).base_price) *
    c.wealth ** p.economy.wealth_price_exponent *
    (md / ms) ** p.economy.elasticity
  );
}

/**
 * Event multipliers of a market (F-ECO-09): M_d in F-ECO-01, M_s in F-ECO-03. Missing = 1.
 * Only the rules decided in economy.md; extensions of the simulation (F-ECO-10 ff.) stay there.
 */
export interface MarketMods {
  readonly demand?: number;
  readonly supply?: number;
}

function good(p: GameParameters, g: string) {
  if (!own(p.goods, g)) throw new RangeError(`unknown good: ${g}`);
  return p.goods[g] as GameParameters['goods'][string];
}

function marketMultipliers(p: GameParameters, cid: string, g: string): [number, number] {
  const m = multipliers(p, cid, g);
  if (!m) throw new RangeError(`no market: ${cid}/${g}`);
  return m;
}

/** pop · c · W^β, the common factor of F-ECO-01 and F-ECO-02. */
function consumptionBase(p: GameParameters, cid: string, g: string): number {
  const { c } = loc(p, cid);
  return c.pop * good(p, g).consumption * c.wealth ** p.cities.demand_wealth_exponent;
}

/** F-ECO-01: demand per tick D = pop · c · W^β · m_d · M_d. */
export function demand(p: GameParameters, cid: string, g: string, mods?: MarketMods): number {
  const [, md] = marketMultipliers(p, cid, g);
  return consumptionBase(p, cid, g) * md * (mods?.demand ?? 1);
}

/** F-ECO-02: supply level per tick A = pop · c · W^β · m_s. */
export function supplyLevel(p: GameParameters, cid: string, g: string): number {
  const [ms] = marketMultipliers(p, cid, g);
  return consumptionBase(p, cid, g) * ms;
}

/** F-ECO-03 (a): reference stock S_ref = D · cover (with M_d). */
export function refStock(p: GameParameters, cid: string, g: string, mods?: MarketMods): number {
  return demand(p, cid, g, mods) * p.economy.cover_ticks;
}

/** F-ECO-03 (b): target stock S_target = A · cover · M_s. */
export function targetStock(p: GameParameters, cid: string, g: string, mods?: MarketMods): number {
  return supplyLevel(p, cid, g) * p.economy.cover_ticks * (mods?.supply ?? 1);
}

/** F-ECO-04: S_{t+1} = max(S_min, S_t + λ (S_target − S_t)). */
export function stockStep(p: GameParameters, S: number, sTarget: number): number {
  return Math.max(p.economy.min_stock, S + p.economy.reversion_rate * (sTarget - S));
}

/** F-ECO-04 closed form: S_t = S_target + (S_0 − S_target)(1 − λ)^t. */
export function stockAfter(p: GameParameters, s0: number, sTarget: number, ticks: number): number {
  return sTarget + (s0 - sTarget) * (1 - p.economy.reversion_rate) ** ticks;
}

/** F-ECO-05: x_{t+1} = ρ x_t + σ z_t; the noise factor is N = e^x. */
export function noiseStep(p: GameParameters, x: number, sigma: number, z: number): number {
  return p.economy.noise_rho * x + sigma * z;
}

/** [P_min, P_max] = [min_factor, max_factor] · P_base (cents as float). */
export function priceBounds(p: GameParameters, g: string): [number, number] {
  const pb = Number(good(p, g).base_price);
  return [pb * p.economy.price_min_factor, pb * p.economy.price_max_factor];
}

/** K = P_base · W^ω · S_ref^ε · e^x, so that P(S) = clamp(K · S^−ε) (F-ECO-06, F-TRD-01). */
export function priceK(p: GameParameters, cid: string, g: string, x = 0, mods?: MarketMods): number {
  const { c } = loc(p, cid);
  return (
    Number(good(p, g).base_price) *
    c.wealth ** p.economy.wealth_price_exponent *
    refStock(p, cid, g, mods) ** p.economy.elasticity *
    Math.exp(x)
  );
}

/** F-ECO-06: P = clamp(P_base · W^ω · (S_ref / S)^ε · e^x, P_min, P_max) (cents as float). */
export function marketPrice(
  p: GameParameters,
  cid: string,
  g: string,
  S: number,
  x = 0,
  mods?: MarketMods,
): number {
  const [lo, hi] = priceBounds(p, g);
  return Math.max(lo, Math.min(hi, priceK(p, cid, g, x, mods) * S ** -p.economy.elasticity));
}

/** F-ECO-08: half-life of market recovery t_½ = ln 0.5 / ln(1 − λ) in ticks. */
export function halfLife(lambda: number): number {
  return Math.log(0.5) / Math.log(1 - lambda);
}

/**
 * F-ECO-09: the event for a uniform draw u ∈ [0, 1). The events occupy consecutive intervals of
 * length `probability` in the order of [events] in parameters.toml; null = no event.
 */
export function pickEvent(p: GameParameters, u: number): string | null {
  let acc = 0;
  for (const [id, ev] of Object.entries(p.events)) {
    acc += ev.probability;
    if (u < acc) return id;
  }
  return null;
}

function marketEvent(p: GameParameters, ev: string) {
  if (!own(p.events, ev)) throw new RangeError(`unknown event: ${ev}`);
  return p.events[ev] as GameParameters['events'][string];
}

/** F-ECO-09: stock shock when an event starts, S ← S · stock_shock. */
export function applyEventShock(p: GameParameters, S: number, ev: string): number {
  return S * marketEvent(p, ev).stock_shock;
}

/** Persistent state of one market (economy.md §2; MarketState in the database). */
export interface MarketTickState {
  /** S_t, units (float). */
  readonly stock: number;
  /** x_t, log noise. */
  readonly noise: number;
  readonly activeEvent: string | null;
  /** Remaining ticks of the active event, 0 without event. */
  readonly eventTicksLeft: number;
}

export interface MarketTickResult extends MarketTickState {
  /** F-ECO-06 price after the tick, cents as float (display/cache, not persisted). */
  readonly price: number;
}

/**
 * One tick of one market (economy.md §5), as in verify.py (inv_monte_carlo):
 * 1. Without an active event: roll U(seed, t, "<city>/<good>", 0); a new event shocks the stock.
 * 2. An active event sets M_s, M_d for this tick and counts down; at 0 it ends after this tick.
 * 3. Noise x with Z(seed, t, "<city>/<good>", 1) (F-ECO-05), stock towards S_target(M_s) (F-ECO-04).
 * Pure and deterministic: the same inputs give the same state on every server (F-GLB-01/02).
 * Not included: NPC trader flows (F-NPC-01), which run before F-ECO-04 (game design README §4);
 * they follow with T-506.
 */
export function marketTick(
  p: GameParameters,
  seed: string,
  tick: number,
  cid: string,
  g: string,
  state: MarketTickState,
): MarketTickResult {
  const entity = `${cid}/${g}`;
  let { stock, activeEvent, eventTicksLeft } = state;
  if (activeEvent === null) {
    const started = pickEvent(p, uniform(seed, tick, entity, 0));
    if (started !== null) {
      activeEvent = started;
      eventTicksLeft = marketEvent(p, started).duration;
      stock = applyEventShock(p, stock, started);
    }
  }
  let mods: MarketMods = {};
  if (activeEvent !== null) {
    const ev = marketEvent(p, activeEvent);
    mods = { supply: ev.supply_mult, demand: ev.demand_mult };
    eventTicksLeft -= 1;
    if (eventTicksLeft <= 0) {
      activeEvent = null;
      eventTicksLeft = 0;
    }
  }
  const noise = noiseStep(p, state.noise, good(p, g).volatility, normal(seed, tick, entity, 1));
  stock = stockStep(p, stock, targetStock(p, cid, g, mods));
  return { stock, noise, activeEvent, eventTicksLeft, price: marketPrice(p, cid, g, stock, noise, mods) };
}
