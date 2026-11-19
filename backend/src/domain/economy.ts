/**
 * Economy rules (docs/game-design/economy.md, ownership Agent 5 per ADR-022).
 * Pure functions, same names and semantics as sim/src/model/economy.ts and verify.py, so the
 * simulation can switch to this module (ADR-012). Only what the API needs today; the full
 * price model (F-ECO-01…09) follows with T-103.
 */
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
  const m = multipliers(p, cid, g);
  if (!m) throw new RangeError(`no market: ${cid}/${g}`);
  const [ms, md] = m;
  const basePrice = Number((p.goods[g] as { base_price: bigint }).base_price);
  return basePrice * c.wealth ** p.economy.wealth_price_exponent * (md / ms) ** p.economy.elasticity;
}
