/**
 * ÜBERGANGS-Formelschicht (ADR-012): Geldwäsche-Stufen und Kredithai nach Agent 2
 * (docs/game-design/money-laundering.md F-ML-07…10, ADR-023). Referenz: verify.py
 * `gambling`, `tier_wash`, `papers_event`, `loan_shark_eligible`, `loan_shark_repay`.
 * W2 (eigene Betriebe, F-ML-01…06) ist nicht abgebildet.
 */
import type { LoanShark, Params, WashTier } from '../params.js';
import { ceilCt, floorCt } from './economy.js';

export function tiers(p: Params): Record<string, WashTier> {
  const t = p.laundering?.tiers;
  if (!t) throw new Error('parameters.toml: [laundering.tiers.*] fehlt (T-120, Agent 2)');
  return t;
}

export function loanShark(p: Params): LoanShark {
  if (!p.loan_shark) throw new Error('parameters.toml: [loan_shark] fehlt (T-120, Agent 2)');
  return p.loan_shark;
}

export function hasAdr023(p: Params): boolean {
  return !!p.laundering?.tiers && !!p.loan_shark;
}

/** F-ML-07 (a): r = r_min + (r_max − r_min) · U. */
export function gamblingRate(t: WashTier, u: number): number {
  return t.rate_min! + (t.rate_max! - t.rate_min!) * u;
}

/** Tageslimit einer Stufe (W0 wächst mit dem Finanzen-Level). */
export function dailyCap(t: WashTier, lFin: number): number {
  return t.daily_cap ?? t.daily_cap_base! + t.daily_cap_per_level! * lFin;
}

/** Erwarteter Kurs einer Stufe. */
export function expectedRate(t: WashTier): number {
  return t.rate ?? (t.rate_min! + t.rate_max!) / 2;
}

/** F-ML-07/08: angenommener Betrag und Gutschrift. `u` nur für W0 (Glücksspiel). */
export function wash(t: WashTier, x: number, lFin: number, usedToday: number, u: number): { accepted: number; credit: number; rate: number } {
  if (lFin < t.min_level) return { accepted: 0, credit: 0, rate: 0 };
  if (x < (t.min_amount ?? 0)) return { accepted: 0, credit: 0, rate: 0 };
  const accepted = Math.max(0, Math.min(x, dailyCap(t, lFin) - usedToday));
  const rate = t.rate ?? gamblingRate(t, u);
  return { accepted, credit: floorCt(accepted * rate), rate };
}

/** F-ML-09: Beschlagnahme bei „Papers“ = ⌈r · Gutschriften im Rückblick⌉ (höchstens Kontostand). */
export function papersConfiscation(t: WashTier, creditsLookback: number): number {
  return ceilCt((t.papers_confiscation_rate ?? 0) * creditsLookback);
}

/** F-ML-10 (a). */
export function loanSharkEligible(k: LoanShark, vehicles: number, weapons: number, cashBlack: number, cashWhite: number, openLoan: boolean): boolean {
  return vehicles <= k.max_vehicles && weapons <= k.max_weapons && cashBlack + cashWhite < k.max_assets && !openLoan;
}

/** F-ML-10 (b): Tilgung = min(Rest, ⌈r · Erlös⌉). */
export function loanSharkRepay(k: LoanShark, revenue: number, outstanding: number): number {
  return Math.min(outstanding, ceilCt(k.repayment_rate * revenue));
}
