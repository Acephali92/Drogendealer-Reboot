/**
 * ÜBERGANGS-Formelschicht (ADR-012): Städte, Reisen, Kontrollen nach Agent 2
 * (cities.md F-CTY-01…03, travel.md F-TRV-01…06), Progression (professions.md F-PRF-01/02).
 */
import type { Params } from '../params.js';
import { ceilCt, clamp, EPS, loc, ticksPerHour } from './economy.js';
import { bonus } from './trade.js';

/** F-CTY-01: H_{t+n} = H_t · (1 − δ_0 · (1 − d · Polizei))^n. */
export function heatDecay(p: Params, H: number, cid: string, ticks = 1, policeOverride?: number): number {
  const police = policeOverride ?? loc(p, cid).c.police;
  const delta = p.heat.decay_base * (1 - p.heat.police_decay_damping * police);
  return H * (1 - delta) ** ticks;
}

/** F-CTY-02: Fahndungsdruck Π = Polizei · (1 + H/100). */
export function policePressure(police: number, H: number): number {
  return police * (1 + H / 100);
}

export type Availability = 'knapp' | 'gering' | 'normal' | 'gut' | 'reichlich';

/** F-CTY-03: Verfügbarkeitsstufe aus v = S / S_ref. */
export function availability(S: number, sRef: number): Availability {
  const v = S / sRef;
  if (v < 0.5) return 'knapp';
  if (v < 0.8) return 'gering';
  if (v <= 1.25) return 'normal';
  if (v <= 2.0) return 'gut';
  return 'reichlich';
}

const distCache = new WeakMap<Params, Map<string, Map<string, number>>>();

export function distance(p: Params, a: string, b: string): number {
  let byP = distCache.get(p);
  if (!byP) distCache.set(p, (byP = new Map()));
  let row = byP.get(a);
  if (!row) byP.set(a, (row = new Map()));
  const hit = row.get(b);
  if (hit !== undefined) return hit;
  const key = [a, b].sort().join('-');
  const d = p.distances[key] ?? (p.space_distances as Record<string, number> | undefined)?.[key];
  if (d === undefined) throw new Error(`Keine Distanz: ${key}`);
  row.set(b, d);
  return d;
}

/** F-TRV-01: T = ⌈d / v · Ticks_pro_Stunde⌉. */
export function travelTicks(p: Params, d: number, speed: number): number {
  return Math.ceil((d / speed) * ticksPerHour(p) - EPS);
}

/** F-TRV-02: Kosten = ⌈d · Verbrauch / 100 · Treibstoffpreis_Start⌉. */
export function fuelCost(p: Params, d: number, vehicle: string, start: string): number {
  const v = p.vehicles[vehicle]!;
  return ceilCt(((d * v.consumption) / 100) * p.city[start]!.fuel_price);
}

/** F-TRV-03: Bahnticket = ⌈d · Preis_pro_km⌉ (nur Rucksack). */
export function trainCost(p: Params, d: number): number {
  return ceilCt(d * p.travel.train_price_per_km);
}

/** F-TRV-05: hv = Σ q · P_base · h / 100 000;  g = 1 + hv / (hv + hv_½). */
export function cargoHeat(p: Params, cargo: Record<string, number>): { hv: number; g: number } {
  let hv = 0;
  for (const [g, q] of Object.entries(cargo)) hv += q * p.goods[g]!.base_price * p.goods[g]!.heat;
  hv /= 100_000;
  return { hv, g: 1 + hv / (hv + p.travel.cargo_heat_half) };
}

export interface ControlInfo {
  n: number;
  policeAvg: number;
  hv: number;
  g: number;
  pSeg: number;
  pTotal: number;
}

/** F-TRV-04: p_seg = min(p_max, c_0 · Π_avg · g · (1 − hide) · (1 − Bonus)); p = 1 − (1 − p_seg)^n. */
export function controlProbability(
  p: Params,
  a: string,
  b: string,
  cargo: Record<string, number>,
  H: number,
  hide: number,
  lSchmuggel: number,
  policeOf: (cid: string) => number = (cid) => p.city[cid]!.police,
): ControlInfo {
  const d = distance(p, a, b);
  const n = Math.ceil(d / p.travel.segment_km - EPS);
  const policeAvg = (policeOf(a) + policeOf(b)) / 2;
  const { hv, g } = cargoHeat(p, cargo);
  const pSeg = Math.min(
    p.travel.control_segment_max,
    p.travel.control_base * policePressure(policeAvg, H) * g * (1 - hide) * (1 - bonus(p, 'schmuggel_control_reduction', lSchmuggel)),
  );
  return { n, policeAvg, hv, g, pSeg, pTotal: 1 - (1 - pSeg) ** n };
}

/** F-TRV-06: Strafe, Bestechungskosten und Bestechungschance. */
export function bust(p: Params, cargo: Record<string, number>, police: number, lSchmuggel: number) {
  let V = 0;
  for (const [g, q] of Object.entries(cargo)) V += q * p.goods[g]!.base_price;
  return {
    cargoBaseValue: V,
    fine: ceilCt(p.travel.fine_rate * V),
    bribeCost: ceilCt(p.travel.bribe_cost_rate * V * (1 + police)),
    bribeChance: clamp(
      p.travel.bribe_base_success - p.travel.bribe_police_penalty * police + (p.professions.schmuggel_bribe_bonus as number) * lSchmuggel,
      p.travel.bribe_success_min,
      p.travel.bribe_success_max,
    ),
  };
}

/** F-PRF-01: L = min(L_max, ⌊√(XP / k)⌋). */
export function level(p: Params, xp: number): number {
  return Math.min(p.professions.level_max, Math.floor(Math.sqrt(Math.floor(Math.floor(xp) / p.professions.xp_per_level_k))));
}

export function xpForLevel(p: Params, L: number): number {
  return p.professions.xp_per_level_k * L * L;
}

/** F-PRF-02 (Handel, Schmuggel). */
export function xpHandel(p: Params, volumeCt: number): number {
  return Math.floor((volumeCt / 100) * p.professions.handel_xp_per_eur + EPS);
}

export function xpSchmuggel(p: Params, km: number, hv: number): number {
  return Math.floor(km * p.professions.schmuggel_xp_per_km + hv * p.professions.schmuggel_xp_per_cargo_heat + EPS);
}
