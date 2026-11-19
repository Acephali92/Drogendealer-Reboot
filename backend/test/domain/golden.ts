/** Reference values exported from docs/game-design/tools/verify.py (scripts/export-golden-vectors.py). */
import { readFileSync } from 'node:fs';

export interface GoldenRngRow {
  seed: string;
  tick: number;
  entity: string;
  k: number;
  uniform: number;
  normal: number;
}

export interface GoldenVectors {
  sources: Record<string, string>;
  examples: Record<string, Record<string, unknown>>;
  parameters: Record<string, unknown>;
  rng: GoldenRngRow[];
  formulas: GoldenFormulas;
}

export const golden: GoldenVectors = JSON.parse(
  readFileSync(new URL('../golden/golden-vectors.json', import.meta.url), 'utf8'),
);

export const PARAMETERS_TOML = readFileSync(
  new URL('../../../docs/game-design/parameters.toml', import.meta.url),
  'utf8',
);

/** Asserts that `actual` rounds to the verify.py example value `expected` with `digits` decimals. */
export function roundsTo(actual: number, expected: unknown, digits: number): boolean {
  return typeof expected === 'number' && Math.abs(actual - expected) <= 0.5 * 10 ** -digits + 1e-9;
}

/** Relative closeness for unrounded float formulas (pow/exp/log may differ by a few ULP across runtimes). */
export function close(actual: number, expected: number, rel = 1e-12): boolean {
  return Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected));
}

export interface GoldenMarket {
  city: string;
  good: string;
  demand: number;
  supply_level: number;
  ref_stock: number;
  target_stock: number;
  equilibrium_price: number;
  price_K: number;
  max_order: number;
  events: Record<string, { ref_stock: number; target_stock: number; shocked: number }>;
  prices: Array<{ S: number; x: number; ev_d: number; price: number }>;
  buy: Array<{ S: number; q: number; L: number; x: number; cost: number; S_after: number }>;
  sell: Array<{ S: number; q: number; L: number; x: number; revenue: number; S_after: number }>;
}

export interface GoldenTickSnapshot {
  tick: number;
  stock: number;
  noise: number;
  event: string | null;
  left: number;
  price: number;
}

export interface GoldenFormulas {
  markets: GoldenMarket[];
  price_integral: Array<{
    eps: number;
    K: number;
    a: number;
    b: number;
    pmin: number;
    pmax: number;
    value: number;
  }>;
  spread: Array<{ L: number; spread: number }>;
  spoiled_quantity: Array<{ good: string; q0: number; dt: number; q: number }>;
  trade_heat: Array<{ good: string; H: number; value: number; heat: number }>;
  carry_capacity: Array<{ vehicle: string | null; capacity: number }>;
  pick_event: Array<{ u: number; event: string | null }>;
  half_life: Array<{ lambda: number; ticks: number }>;
  stock_after: Array<{ S0: number; S_target: number; ticks: number; S: number }>;
  ticks: {
    seed: string;
    count: number;
    markets: Array<{ city: string; good: string; initial_stock: number; snapshots: GoldenTickSnapshot[] }>;
  };
}

export const formulas = golden.formulas;
