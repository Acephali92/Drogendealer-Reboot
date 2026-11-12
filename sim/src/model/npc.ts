/**
 * ÜBERGANGS-Formelschicht (ADR-012): NPC-Händler und Rückbau nach Agent 2
 * (docs/game-design/npc.md, F-NPC-01 und F-NPC-04). Kuriere/Banden (F-NPC-02/03) gehören
 * zum Kampfsystem und sind in der Simulation nicht umgesetzt.
 */
import type { Params } from '../params.js';
import { clamp, demand, type MarketMods, marketPrice, stockStep, supplyLevel, targetStock } from './economy.js';
import { spread } from './trade.js';
import { distance } from './travel.js';

export interface NpcParams {
  k_start: number;
  k_min: number;
  k_max: number;
  trader_intensity: number;
  trader_threshold_base: number;
  trader_threshold_per_km: number;
  trader_threshold_scale: number;
  handover_hold_days: number;
  handover_miss_days: number;
  handover_step: number;
  handover_step_days: number;
  handover_route_competition: number;
  handover_target_availability: number;
  handover_market_activity: number;
  handover_min_peak_online: number;
  handover_top_routes: number;
}

export function npcParams(p: Params): NpcParams {
  const n = p.npc as NpcParams | undefined;
  if (!n) throw new Error('parameters.toml: Abschnitt [npc] fehlt (npc.md, Agent 2)');
  return n;
}

/** F-NPC-01: NPC-Handelsfluss a → b pro Tick (Preise ohne Rauschen). */
export function npcRouteFlow(p: Params, a: string, b: string, g: string, Sa: number, Sb: number, k: number, modsA?: MarketMods, modsB?: MarketMods) {
  const n = npcParams(p);
  const s = spread(p, 0);
  const m = (marketPrice(p, b, g, Sb, 0, modsB) * (1 - s / 2)) / (marketPrice(p, a, g, Sa, 0, modsA) * (1 + s / 2)) - 1;
  const theta = n.trader_threshold_base + n.trader_threshold_per_km * distance(p, a, b);
  const f = clamp((m - theta) / n.trader_threshold_scale, 0, 1);
  const q = k * n.trader_intensity * Math.min(supplyLevel(p, a, g, modsA), demand(p, b, g, modsB)) * f;
  return { margin: m, theta, f, q };
}

/**
 * F-NPC-01 (Tick, ohne Erholung): alle Flüsse einer Ware aus demselben Zustand berechnen und
 * gleichzeitig anwenden (Untergrenze S_min). Gibt die neuen Bestände zurück.
 */
export function npcTraderFlows(p: Params, g: string, S: Record<string, number>, k: number, mods: (c: string) => MarketMods | undefined = () => undefined): Record<string, number> {
  const delta: Record<string, number> = {};
  const cities = Object.keys(S);
  for (const c of cities) delta[c] = 0;
  for (const a of cities)
    for (const b of cities) {
      if (a === b) continue;
      const q = npcRouteFlow(p, a, b, g, S[a]!, S[b]!, k, mods(a), mods(b)).q;
      delta[a]! -= q;
      delta[b]! += q;
    }
  const out: Record<string, number> = {};
  for (const c of cities) out[c] = Math.max(p.economy.min_stock, S[c]! + delta[c]!);
  return out;
}

/** Gleichgewicht nach F-NPC-01 + F-ECO-04 (wie verify.py npc_equilibrium). */
export function npcEquilibrium(p: Params, g: string, k: number, ticks = 3000): Record<string, number> {
  let S: Record<string, number> = {};
  for (const c of Object.keys(p.city)) S[c] = targetStock(p, c, g);
  for (let i = 0; i < ticks; i++) {
    const f = npcTraderFlows(p, g, S, k);
    S = Object.fromEntries(Object.entries(f).map(([c, v]) => [c, stockStep(p, v, targetStock(p, c, g))]));
  }
  return S;
}

/** F-NPC-04: k sinkt bei met = hold, hold+step_days, …; steigt bei miss = miss_days, miss_days+step_days, … */
export function handoverUpdate(p: Params, k: number, met: number, miss: number): number {
  const n = npcParams(p);
  if (met >= n.handover_hold_days && (met - n.handover_hold_days) % n.handover_step_days === 0) k -= n.handover_step;
  if (miss >= n.handover_miss_days && (miss - n.handover_miss_days) % n.handover_step_days === 0) k += n.handover_step;
  return Math.round(clamp(k, n.k_min, n.k_max) * 1e10) / 1e10;
}

export function handoverRun(p: Params, daysMet: boolean[], k = npcParams(p).k_start): number[] {
  let met = 0;
  let miss = 0;
  const out: number[] = [];
  for (const ok of daysMet) {
    if (ok) {
      met += 1;
      miss = 0;
    } else {
      miss += 1;
      met = 0;
    }
    k = handoverUpdate(p, k, met, miss);
    out.push(k);
  }
  return out;
}
