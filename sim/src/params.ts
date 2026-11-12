/**
 * Lädt die Spielparameter (Single Source of Truth: docs/game-design/parameters.toml, Agent 2)
 * und die Vorschlagsparameter von Agent 5 (sim/proposals.toml).
 *
 * Werte werden NICHT im Code dupliziert (ADR-012, PROJECT.md §5).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';

export const SIM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(SIM_ROOT, '..');
export const DEFAULT_PARAMS_PATH = resolve(REPO_ROOT, 'docs/game-design/parameters.toml');
export const DEFAULT_PROPOSALS_PATH = resolve(SIM_ROOT, 'proposals.toml');

export interface Good {
  name: string;
  realm: 'earth' | 'space';
  base_price: number;
  consumption: number;
  volatility: number;
  volume: number;
  spoil_rate: number;
  heat: number;
}

export interface City {
  name: string;
  pop: number;
  wealth: number;
  police: number;
  fuel_price: number;
  spaceport?: boolean;
  supply?: Record<string, number>;
  demand?: Record<string, number>;
}

export interface Vehicle {
  name: string;
  price: number;
  speed: number;
  consumption: number;
  capacity: number;
  hide: number;
}

export interface MarketEvent {
  name: string;
  probability: number;
  duration: number;
  stock_shock: number;
  supply_mult: number;
  demand_mult: number;
}

/** Ausschnitt aus parameters.toml, den die Simulation nutzt. Weitere Abschnitte bleiben untypisiert. */
export interface Params {
  meta: { version: string; tick_minutes: number; ticks_per_day: number };
  player: { start_cash_black: number; start_cash_white: number; backpack_capacity: number };
  heat: { max: number; decay_base: number; police_decay_damping: number; trade_heat_per_keur: number };
  economy: {
    elasticity: number;
    wealth_price_exponent: number;
    cover_ticks: number;
    reversion_rate: number;
    noise_rho: number;
    price_min_factor: number;
    price_max_factor: number;
    min_stock: number;
  };
  cities: { demand_wealth_exponent: number };
  goods: Record<string, Good>;
  events: Record<string, MarketEvent>;
  city: Record<string, City>;
  distances: Record<string, number>;
  travel: {
    train_speed: number;
    train_price_per_km: number;
    segment_km: number;
    control_base: number;
    control_segment_max: number;
    cargo_heat_half: number;
    fine_rate: number;
    heat_on_bust: number;
    bribe_cost_rate: number;
    bribe_base_success: number;
    bribe_police_penalty: number;
    bribe_success_min: number;
    bribe_success_max: number;
    debt_repayment_rate?: number;
    vehicle_resale_rate?: number;
  };
  vehicles: Record<string, Vehicle>;
  professions: Record<string, number | string[] | undefined> & {
    xp_per_level_k: number;
    level_max: number;
    handel_xp_per_eur: number;
    schmuggel_xp_per_km: number;
    schmuggel_xp_per_cargo_heat: number;
  };
  unlocks: Record<string, { field?: string; level?: number; level_sum?: number; white_cash?: number; networth?: number }>;
  trade: { spread_base: number; max_trade_share: number; slippage_tolerance?: number };
  bounds?: Record<string, [number, number]>;
  [section: string]: unknown;
}

export interface LoadedToml<T> {
  data: T;
  path: string;
  sha256: string;
}

function loadToml<T>(path: string): LoadedToml<T> {
  const text = readFileSync(path, 'utf8');
  return {
    data: parse(text) as unknown as T,
    path,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

/** Pfad: --params > ENV SIM_PARAMS > docs/game-design/parameters.toml */
export function resolveParamsPath(explicit?: string): string {
  return resolve(explicit ?? process.env.SIM_PARAMS ?? DEFAULT_PARAMS_PATH);
}

export function paramsAvailable(explicit?: string): boolean {
  return existsSync(resolveParamsPath(explicit));
}

export function loadParams(explicit?: string): LoadedToml<Params> {
  const path = resolveParamsPath(explicit);
  if (!existsSync(path)) {
    throw new Error(
      `parameters.toml nicht gefunden: ${path}\n` +
        'Die Datei gehört Agent 2 (docs/game-design/). Pfad per --params oder SIM_PARAMS setzen.',
    );
  }
  const loaded = loadToml<Params>(path);
  validate(loaded.data);
  return loaded;
}

export function loadProposals(explicit?: string): LoadedToml<Proposals> {
  return loadToml<Proposals>(resolve(explicit ?? DEFAULT_PROPOSALS_PATH));
}

function validate(p: Params): void {
  const need = ['meta', 'player', 'heat', 'economy', 'cities', 'goods', 'events', 'city', 'distances', 'travel', 'vehicles', 'professions', 'trade'];
  for (const k of need) if (!(k in p)) throw new Error(`parameters.toml: Abschnitt [${k}] fehlt`);
  for (const [key, [lo, hi]] of Object.entries(p.bounds ?? {})) {
    const v = getPath(p, key);
    if (typeof v === 'number' && (v < lo || v > hi)) throw new Error(`parameters.toml: ${key}=${v} außerhalb [${lo}, ${hi}]`);
  }
}

export function getPath(obj: unknown, dotted: string): unknown {
  let cur: unknown = obj;
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Setzt einen Wert per Punkt-Pfad (für --set key=value in Experimenten). Gibt eine Kopie zurück. */
export function withOverride<T>(obj: T, dotted: string, value: number | boolean | string): T {
  const copy = structuredClone(obj) as Record<string, unknown>;
  const parts = dotted.split('.');
  let cur: Record<string, unknown> = copy;
  for (const part of parts.slice(0, -1)) {
    if (typeof cur[part] !== 'object' || cur[part] === null) throw new Error(`Unbekannter Pfad: ${dotted}`);
    cur = cur[part] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  if (!(last in cur)) throw new Error(`Unbekannter Schlüssel: ${dotted}`);
  cur[last] = value;
  return copy as T;
}

/** Vorschläge von Agent 5 (noch nicht in parameters.toml). Siehe sim/proposals.toml. */
export interface Proposals {
  meta: { version: string; status: string };
  economy_ext: {
    wealth_cycle_amplitude: number;
    wealth_cycle_period_days: number;
    crisis_probability_per_day: number;
    crisis_demand_mult: number;
    crisis_duration_days: [number, number];
    regional_noise_share: number;
    supply_response_rate: number;
    supply_response_min: number;
    supply_response_max: number;
    weekend_demand_mult: number;
    weekend_goods: string[];
  };
  npc_ext: {
    consumer_satisfaction_rate: number;
    consumer_scarcity_threshold: number;
    consumer_demand_min: number;
    consumer_demand_max: number;
    police_pressure_per_keur_day: number;
    police_pressure_max: number;
    police_pressure_decay: number;
  };
  safety_net: { start_loan_ct: number; min_cash_threshold_ct: number; cooldown_days: number };
  progression: { org_cost_rate_per_day: number; org_cost_threshold_ct: number; catchup_xp_bonus: number; growth_ranking_min_base_ct: number; prestige_base_ct: number };
}
