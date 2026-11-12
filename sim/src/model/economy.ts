/**
 * ÜBERGANGS-Formelschicht (ADR-012): Portierung der Wirtschaftsformeln von Agent 2
 * (docs/game-design/economy.md, F-ECO-01…09). Wird gegen backend/src/domain/ getauscht,
 * sobald Agent 3 die Regelfunktionen liefert. Golden-Tests: test/golden.test.ts.
 */
import type { City, Params } from '../params.js';

export const EPS = 1e-9;

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Spieler zahlt: aufrunden auf ganze Cent (Toleranz gegen Float-Rauschen). */
export function ceilCt(x: number): number {
  return Math.ceil(x - EPS);
}

/** Spieler erhält: abrunden auf ganze Cent. */
export function floorCt(x: number): number {
  return Math.floor(x + EPS);
}

export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

export function ticksPerHour(p: Params): number {
  return 60 / p.meta.tick_minutes;
}

export function loc(p: Params, cid: string): { c: City; realm: 'earth' | 'space' } {
  const earth = p.city[cid];
  if (earth) return { c: earth, realm: 'earth' };
  const space = (p.space_location as Record<string, City> | undefined)?.[cid];
  if (space) return { c: space, realm: 'space' };
  throw new Error(`Unbekannter Ort: ${cid}`);
}

/** (m_s, m_d) eines Marktes oder null, wenn die Ware dort nicht gehandelt wird (F-ECO-02). */
export function multipliers(p: Params, cid: string, g: string): [number, number] | null {
  const { c, realm } = loc(p, cid);
  const s = c.supply ?? {};
  const d = c.demand ?? {};
  const good = p.goods[g];
  if (!good) throw new Error(`Unbekannte Ware: ${g}`);
  if (good.realm === realm) return [s[g] ?? 1.0, d[g] ?? 1.0];
  if (g in s && g in d) return [s[g]!, d[g]!];
  return null;
}

export function markets(p: Params, realm: 'earth' | 'all' = 'earth'): Array<[string, string]> {
  const cities = realm === 'earth' ? Object.keys(p.city) : [...Object.keys(p.city), ...Object.keys((p.space_location as object) ?? {})];
  const out: Array<[string, string]> = [];
  for (const cid of cities) for (const g of Object.keys(p.goods)) if (multipliers(p, cid, g)) out.push([cid, g]);
  return out;
}

function mult(p: Params, cid: string, g: string): [number, number] {
  const m = multipliers(p, cid, g);
  if (!m) throw new Error(`Kein Markt: ${cid}/${g}`);
  return m;
}

/** Faktor für Wohlstand: W_eff = W · wealthFactor (Erweiterung F-ECO-10, Standard 1). */
export interface MarketMods {
  /** Ereignis-Nachfragemultiplikator M_d (F-ECO-09) × Erweiterungen (Krise, Wochenende, Kundenbindung) */
  demand?: number;
  /** Ereignis-Angebotsmultiplikator M_s (F-ECO-09) × Erweiterung Angebotsreaktion (F-ECO-13) */
  supply?: number;
  /** Wohlstandsfaktor (F-ECO-10), wirkt auf W */
  wealth?: number;
}

function wealthOf(c: City, mods?: MarketMods): number {
  return c.wealth * (mods?.wealth ?? 1);
}

/** F-ECO-01: Nachfrage pro Tick D = pop · c · W^β · m_d · M_d. */
export function demand(p: Params, cid: string, g: string, mods?: MarketMods): number {
  const { c } = loc(p, cid);
  const [, md] = mult(p, cid, g);
  return c.pop * p.goods[g]!.consumption * wealthOf(c, mods) ** p.cities.demand_wealth_exponent * md * (mods?.demand ?? 1);
}

/** F-ECO-02: Angebotsniveau pro Tick A = pop · c · W^β · m_s. */
export function supplyLevel(p: Params, cid: string, g: string, mods?: MarketMods): number {
  const { c } = loc(p, cid);
  const [ms] = mult(p, cid, g);
  return c.pop * p.goods[g]!.consumption * wealthOf(c, mods) ** p.cities.demand_wealth_exponent * ms;
}

/** F-ECO-03 (a): S_ref = D · cover. */
export function refStock(p: Params, cid: string, g: string, mods?: MarketMods): number {
  return demand(p, cid, g, mods) * p.economy.cover_ticks;
}

/** F-ECO-03 (b): S_target = A · cover · M_s. */
export function targetStock(p: Params, cid: string, g: string, mods?: MarketMods): number {
  return supplyLevel(p, cid, g, mods) * p.economy.cover_ticks * (mods?.supply ?? 1);
}

/** F-ECO-04: S_{t+1} = max(S_min, S_t + λ (S_target − S_t)). */
export function stockStep(p: Params, S: number, sTarget: number): number {
  return Math.max(p.economy.min_stock, S + p.economy.reversion_rate * (sTarget - S));
}

/** F-ECO-04 geschlossen: S_t = S_target + (S_0 − S_target)(1 − λ)^t. */
export function stockAfter(p: Params, s0: number, sTarget: number, ticks: number): number {
  return sTarget + (s0 - sTarget) * (1 - p.economy.reversion_rate) ** ticks;
}

/** F-ECO-05: x_{t+1} = ρ x_t + σ z_t. */
export function noiseStep(p: Params, x: number, sigma: number, z: number): number {
  return p.economy.noise_rho * x + sigma * z;
}

export function priceBounds(p: Params, g: string): [number, number] {
  const pb = p.goods[g]!.base_price;
  return [pb * p.economy.price_min_factor, pb * p.economy.price_max_factor];
}

/** K aus F-ECO-06: P(S) = clamp(K · S^-ε). */
export function priceK(p: Params, cid: string, g: string, x = 0, mods?: MarketMods): number {
  const { c } = loc(p, cid);
  return p.goods[g]!.base_price * wealthOf(c, mods) ** p.economy.wealth_price_exponent * refStock(p, cid, g, mods) ** p.economy.elasticity * Math.exp(x);
}

/** F-ECO-06: P = clamp(P_base · W^ω · (S_ref / S)^ε · e^x, P_min, P_max). */
export function marketPrice(p: Params, cid: string, g: string, S: number, x = 0, mods?: MarketMods): number {
  const [lo, hi] = priceBounds(p, g);
  return clamp(priceK(p, cid, g, x, mods) * S ** -p.economy.elasticity, lo, hi);
}

/** F-ECO-07: P* = P_base · W^ω · (m_d / m_s)^ε (ungeklemmt). */
export function equilibriumPrice(p: Params, cid: string, g: string): number {
  const { c } = loc(p, cid);
  const [ms, md] = mult(p, cid, g);
  return p.goods[g]!.base_price * c.wealth ** p.economy.wealth_price_exponent * (md / ms) ** p.economy.elasticity;
}

/** F-ECO-08: t_½ = ln(0,5) / ln(1 − λ) in Ticks. */
export function halfLife(lambda: number): number {
  return Math.log(0.5) / Math.log(1 - lambda);
}

/** F-ECO-09: Ereignis aus U wählen; Reihenfolge der Schlüssel in [events] = Intervallreihenfolge. */
export function pickEvent(p: Params, u: number): string | null {
  let acc = 0;
  for (const [id, ev] of Object.entries(p.events)) {
    if (u >= acc && u < acc + ev.probability) return id;
    acc += ev.probability;
  }
  return null;
}
