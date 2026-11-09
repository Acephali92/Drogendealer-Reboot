/**
 * Spielerprofile für die Simulation (MARKET_SIMULATION.md §4).
 * A–E sind die Szenarien aus dem Auftrag; der Hintergrund-Mix bildet die Standard-Population
 * (ADR-016: 30 Spieler) aus denselben Verhaltensbausteinen mit anderen Aktivitätsprofilen.
 */

export type ProfileId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface BotProfile {
  id: ProfileId;
  name: string;
  /** Sitzungen pro Tag und Sitzungslänge in Ticks (Bot entscheidet nur online). */
  sessionsPerDay: number;
  sessionTicks: number;
  /** Anteil des Bargelds, der nie in Ware gebunden wird. */
  cashReserve: number;
  /** Gewicht des erwarteten Kontrollverlusts in der Routenbewertung (1 = risikoneutral). */
  riskAversion: number;
  /** Höchster Heat-Faktor einer Ware, die gehandelt wird. */
  maxGoodHeat: number;
  /** Fahrzeugkauf erlaubt, wenn Preis ≤ Anteil × Bargeld. */
  vehicleBudgetShare: number;
  /** Bestechung: 'never' | 'ev' (wenn Erwartungswert besser) | 'always' */
  bribe: 'never' | 'ev' | 'always';
  /** Wahrscheinlichkeit einer schlechten Entscheidung (zufällige statt beste Route, Fehlkauf). */
  errorRate: number;
  /** Plant zwei Fahrten voraus (Rundkurs) und bewertet Leerfahrten zu besseren Städten. */
  lookahead: boolean;
  /** Bewertet Fahrzeugkäufe nach Amortisation statt nach Budgetregel. */
  paybackPurchase: boolean;
}

export const PROFILES: Record<ProfileId, BotProfile> = {
  A: {
    id: 'A',
    name: 'Vorsichtig',
    sessionsPerDay: 2,
    sessionTicks: 6,
    cashReserve: 0.5,
    riskAversion: 3,
    maxGoodHeat: 1.0,
    vehicleBudgetShare: 0.3,
    bribe: 'never',
    errorRate: 0.05,
    lookahead: false,
    paybackPurchase: false,
  },
  B: {
    id: 'B',
    name: 'Durchschnitt',
    sessionsPerDay: 4,
    sessionTicks: 9,
    cashReserve: 0.1,
    riskAversion: 1,
    maxGoodHeat: 2.0,
    vehicleBudgetShare: 0.5,
    bribe: 'ev',
    errorRate: 0.1,
    lookahead: false,
    paybackPurchase: false,
  },
  C: {
    id: 'C',
    name: 'Aggressiv',
    sessionsPerDay: 6,
    sessionTicks: 9,
    cashReserve: 0,
    riskAversion: 0.5,
    maxGoodHeat: 9,
    vehicleBudgetShare: 0.85,
    bribe: 'always',
    errorRate: 0.1,
    lookahead: false,
    paybackPurchase: false,
  },
  D: {
    id: 'D',
    name: 'Ineffizient',
    sessionsPerDay: 2,
    sessionTicks: 6,
    cashReserve: 0.05,
    riskAversion: 0.8,
    maxGoodHeat: 9,
    vehicleBudgetShare: 0.95,
    bribe: 'always',
    errorRate: 0.3,
    lookahead: false,
    paybackPurchase: false,
  },
  E: {
    id: 'E',
    name: 'Optimiert',
    sessionsPerDay: 8,
    sessionTicks: 12,
    cashReserve: 0.02,
    riskAversion: 1,
    maxGoodHeat: 9,
    vehicleBudgetShare: 0.7,
    bribe: 'ev',
    errorRate: 0,
    lookahead: true,
    paybackPurchase: true,
  },
};

/**
 * Hintergrund-Mix (ADR-016 Standard-Population, MARKET_SIMULATION.md §4.3):
 * Gelegenheitsspieler → A-Verhalten, aktive Händler → B, Schmuggler → C, Neulinge → D, Optimierer/Veteranen → E.
 */
export const BACKGROUND_MIX: Array<[ProfileId, number]> = [
  ['A', 0.4],
  ['B', 0.28],
  ['C', 0.15],
  ['D', 0.1],
  ['E', 0.07],
];

export function backgroundProfiles(n: number): ProfileId[] {
  const out: ProfileId[] = [];
  for (const [id, share] of BACKGROUND_MIX) for (let i = 0; i < Math.round(share * n); i++) out.push(id);
  while (out.length < n) out.push('B');
  return out.slice(0, n);
}
