/**
 * [Design-Vorschlag] Agent 5: Wirtschaftliche Eigendynamik und NPC-Mechaniken.
 * Spezifikation: docs/balancing/GAME_ECONOMY.md §5 (F-ECO-10…14) und NPC_BEHAVIOR.md.
 * Werte: sim/proposals.toml. Alles ist abschaltbar; ohne Erweiterungen rechnet die
 * Simulation exakt nach Agent 2s Regeln.
 */
import type { Proposals } from '../params.js';

/** F-ECO-10: Wohlstandszyklus W_eff = W · (1 + a · sin(2π t / T + φ)). */
export function wealthCycle(pr: Proposals, t: number, ticksPerDay: number, phase: number): number {
  const T = pr.economy_ext.wealth_cycle_period_days * ticksPerDay;
  return 1 + pr.economy_ext.wealth_cycle_amplitude * Math.sin((2 * Math.PI * t) / T + phase);
}

/** F-ECO-11: Kombination aus lokalem und regionalem Rauschen mit gleicher Varianz. */
export function combinedNoise(pr: Proposals, xLocal: number, xRegional: number): number {
  const w = pr.economy_ext.regional_noise_share;
  return Math.sqrt(1 - w) * xLocal + Math.sqrt(w) * xRegional;
}

/** F-ECO-13: Angebotsreaktion m_sup ← clamp(m_sup + r · (P/P* − 1)). */
export function supplyResponse(pr: Proposals, mSup: number, priceRatio: number): number {
  const e = pr.economy_ext;
  return Math.min(e.supply_response_max, Math.max(e.supply_response_min, mSup + e.supply_response_rate * (priceRatio - 1)));
}

/** F-ECO-14: Wochenrhythmus. Tag 0 = Montag; Freitag (4) und Samstag (5) mit Mehrnachfrage. */
export function weekendFactor(pr: Proposals, t: number, ticksPerDay: number, good: string): number {
  const weekday = Math.floor(t / ticksPerDay) % 7;
  return (weekday === 4 || weekday === 5) && pr.economy_ext.weekend_goods.includes(good) ? pr.economy_ext.weekend_demand_mult : 1;
}

/** NPC-1 Konsumentensegmente: Kundenbindung (gute Versorgung) und Abwanderung (Knappheit). */
export function consumerSatisfaction(pr: Proposals, sat: number, v: number): number {
  const n = pr.npc_ext;
  const target = v < n.consumer_scarcity_threshold ? n.consumer_demand_min : v >= 0.8 ? n.consumer_demand_max : 1;
  return sat + n.consumer_satisfaction_rate * (target - sat);
}

/** NPC-4 Polizeidruck: steigt mit Handelsvolumen (in 1 000 €), klingt pro Tick ab. */
export function policePressureUpdate(pr: Proposals, pressure: number, volumeCt: number): number {
  const n = pr.npc_ext;
  return Math.min(n.police_pressure_max, pressure + (n.police_pressure_per_keur_day * volumeCt) / 100_000);
}

export function policePressureDecay(pr: Proposals, pressure: number): number {
  return pressure * (1 - pr.npc_ext.police_pressure_decay);
}
