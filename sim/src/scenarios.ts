/**
 * Szenario-Katalog (MARKET_SIMULATION.md §5). Jede Variante ändert genau EINE Sache gegenüber
 * der Basis, damit Ursache und Wirkung nachvollziehbar bleiben (Arbeitsweise, README.md).
 */
import type { Scenario } from './run.js';

const TRACKED = ['A', 'B', 'C', 'D', 'E'] as const;
const BASE_OPTIONS: Omit<import('./world.js').SimOptions, 'seed' | 'days'> = { economyExt: false, npc: false, npcIntensity: 0, safetyNet: false };

export interface Experiment {
  scenario: Scenario;
  /** Parameter-Overrides auf parameters.toml (nur für Hypothesentests) */
  overrides?: Record<string, number>;
  hypothesis: string;
}

function sc(id: string, title: string, days: number, seeds: number, background: number, options = BASE_OPTIONS): Scenario {
  return { id, title, days, seeds, background, tracked: [...TRACKED], options, checkpoints: [1, 7, 30, 90, 180, 365].filter((d) => d <= days) };
}

export const EXPERIMENTS: Record<string, Experiment> = {
  base: {
    scenario: sc('base', 'Basis: Regeln von Agent 2 unverändert, 30 Spieler + A–E', 365, 12, 30),
    hypothesis: 'Referenzlauf. Keine Erweiterungen, keine NPCs.',
  },
  'base-short': {
    scenario: sc('base-short', 'Basis über 90 Tage mit mehr Seeds (Streuung)', 90, 24, 30),
    hypothesis: 'Wie base, für robustere Aussagen zu den ersten 90 Tagen.',
  },
  ext: {
    scenario: sc('ext', 'Variante: wirtschaftliche Eigendynamik F-ECO-10…14 an', 90, 12, 30, { ...BASE_OPTIONS, economyExt: true }),
    hypothesis: 'Zyklen, Krisen, Angebotsreaktion und Wochenrhythmus erhöhen die Preisbewegung moderat (P/P* bleibt in 0,85–1,15), ohne Vermögen der Profile stark zu verschieben.',
  },
  npc: {
    scenario: sc('npc', 'Variante: NPC-Händler F-NPC-01 (Agent 2) an, k = 1', 90, 12, 30, { ...BASE_OPTIONS, npc: true, npcIntensity: 1 }),
    hypothesis: 'NPC-Händler halbieren die Spreizung der Top-Route (EX-NPC-01: Preisverhältnis 3,05 → 1,98) und bremsen damit das Wachstum aller Händlerprofile; die Startroute bleibt profitabel (INV-14).',
  },
  'npc-half': {
    scenario: sc('npc-half', 'Variante: NPC-Händler F-NPC-01 an, k = 0,5', 90, 12, 30, { ...BASE_OPTIONS, npc: true, npcIntensity: 0.5 }),
    hypothesis: 'Die Wirkung von k ist monoton: k = 0,5 liegt zwischen Basis und k = 1.',
  },
  'npc-ext': {
    scenario: sc('npc-ext', 'Variante: Kundenbindung/Abwanderung + Polizeidruck (Vorschlag Agent 5), ohne NPC-Händler', 90, 12, 30, { ...BASE_OPTIONS, npcExt: true }),
    hypothesis: 'Kundenbindung bestraft dauerhaftes Leerkaufen (weniger knappe Märkte); Polizeidruck verteilt den Handel auf mehr Städte (geringere Konzentration auf die Top-Märkte).',
  },
  'safety-net': {
    scenario: sc('safety-net', 'Variante: Sicherheitsnetz (Startkredit) an', 90, 12, 30, { ...BASE_OPTIONS, safetyNet: true }),
    hypothesis: 'Der Startkredit verhindert Sackgassen (stuckDays → 0), ohne das Wachstum spürbar zu erhöhen.',
  },
  'pop-10': {
    scenario: sc('pop-10', 'Variante: 10 Hintergrundspieler', 90, 12, 10),
    hypothesis: 'Mit weniger Spielern steigt der Gewinn je Spieler (weniger Konkurrenz um Gewinnpools).',
  },
  'pop-100': {
    scenario: sc('pop-100', 'Variante: 100 Hintergrundspieler', 90, 8, 100),
    hypothesis: 'Mit mehr Spielern sinken Margen; optimierte Spieler verlieren relativ am meisten.',
  },
  'h-elasticity': {
    scenario: sc('h-elasticity', 'Hypothese: economy.elasticity 0,5 → 0,4', 90, 12, 30),
    overrides: { 'economy.elasticity': 0.4 },
    hypothesis: 'Geringere Elastizität verkleinert die Preisspreizung (P* ∝ (m_d/m_s)^ε) und bremst das frühe Wachstum, ohne vorsichtige Spieler (A) weiter zu benachteiligen.',
  },
  'h-confiscation': {
    scenario: sc('h-confiscation', 'Hypothese: Kontrolle beschlagnahmt 50 % statt 100 % der Ladung (Strafe anteilig)', 90, 12, 30, { ...BASE_OPTIONS, confiscationShare: 0.5 }),
    hypothesis: 'Teilbeschlagnahme halbiert den Einzelverlust und senkt die Streuung (P10) der Profile B/C deutlich, ohne das Median-Wachstum zu verdoppeln.',
  },
  's8-handover': {
    scenario: {
      ...sc('s8-handover', 'S8: Zustrom 10 → 150 Spieler, NPC-Händler mit F-NPC-04-Rückbau (k startet bei 1)', 180, 4, 10, { ...BASE_OPTIONS, npc: true, npcIntensity: 1 }),
      growthTo: 150,
      handover: true,
    },
    hypothesis: 'Ab einer bestimmten Zahl regelmäßig aktiver Spieler erfüllen Routen-Konkurrenz, Marktaktivität und Spitzen-Online die Schwellen 14 Tage am Stück; danach sinkt k schrittweise (Prognose für den Betreiber, keine Schwelle).',
  },
  'npc-conf': {
    scenario: sc('npc-conf', 'Variante zu h-confiscation: zusätzlich NPC-Händler F-NPC-01, k = 1', 90, 12, 30, { ...BASE_OPTIONS, npc: true, npcIntensity: 1, confiscationShare: 0.5 }),
    hypothesis: 'Mit Teilbeschlagnahme verlieren NPC-Händler ihren verheerenden Nebeneffekt (mehr Totalverluste durch dünnere Margen); sie bremsen dann nur noch das Wachstum.',
  },
  'h-wealth-sink': {
    scenario: sc('h-wealth-sink', 'Hypothese: Organisationskosten F-PRG-01 (0,5 %/Tag über 500 000 € NW)', 365, 8, 30, { ...BASE_OPTIONS, wealthSink: true }),
    hypothesis: 'Die Organisationskosten lassen frühe Phasen unberührt (< 500 000 €) und flachen das Spätspiel ab: Geldmenge und Vorsprung des reichsten Spielers wachsen langsamer als in base.',
  },
  // ---------------------------------------------------------------- ADR-023 / T-120
  // Werte aus parameters.toml mit [laundering.tiers.*] und [loan_shark] (Agent 2, T-120).
  // Kette: nowash → adr023 (Wäsche) → Kredit-Varianten bzw. Wäsche-Varianten (je eine Änderung ggü. adr023).
  'adr023-nowash': {
    scenario: sc('adr023-nowash', 'ADR-023: Totalbeschlagnahme Ware + Bargeld, ohne Wäsche, ohne Kredithai', 90, 24, 30, { ...BASE_OPTIONS, adr023: true }),
    hypothesis: 'Ohne Wäsche und Kredit führt die Totalbeschlagnahme (inkl. Bargeld) zu mindestens so vielen Sackgassen wie die bisherige Regel (base-short).',
  },
  adr023: {
    scenario: sc('adr023', 'ADR-023 + Waschstufen (Startwerte Agent 2), ohne Kredithai', 90, 24, 30, { ...BASE_OPTIONS, adr023: true, laundering: true }),
    hypothesis: 'Regelmäßiges Waschen hält nach einer Kontrolle eine Reserve auf dem Konto; Sackgassen sinken.',
  },
  'adr023-loan100k': {
    scenario: sc('adr023-loan100k', 'adr023 + Kredithai 100 000 €, Schwelle 2 000 € (Werte ADR-023-Nachtrag)', 90, 24, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true }),
    hypothesis: 'Der große Kredit beseitigt Sackgassen, wird aber auch ohne Pleite genommen (Schwelle = Startkapital) und ist eine große Geldquelle.',
  },
  'adr023-loan10k': {
    scenario: sc('adr023-loan10k', 'adr023 + Kredithai 10 000 €, Schwelle 2 000 €', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true }),
    overrides: { 'loan_shark.amount': 1_000_000 },
    hypothesis: 'Ein mittlerer Kredit reicht für einen Neustart (Kleinwagen 8 000 €).',
  },
  'adr023-loan1k': {
    scenario: sc('adr023-loan1k', 'adr023 + Kredithai 1 000 €, Schwelle 2 000 €', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true }),
    overrides: { 'loan_shark.amount': 100_000 },
    hypothesis: 'Ein kleiner Kredit reicht für einen Neustart mit der Bahn (Startroute ≈ 780 €, INV-04).',
  },
  'adr023-loan100k-200': {
    scenario: sc('adr023-loan100k-200', 'wie adr023-loan100k, Schwelle 200 € statt 2 000 €', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true }),
    overrides: { 'loan_shark.max_assets': 20_000 },
    hypothesis: 'Eine niedrigere Schwelle verhindert, dass Einsteiger den Kredit ohne Not nehmen.',
  },
  'adr023-loan100k-bust': {
    scenario: sc('adr023-loan100k-bust', 'wie adr023-loan100k, Kredit nur innerhalb von 7 Tagen nach einer Beschlagnahme [Design]', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true, loanAfterConfiscation: true }),
    hypothesis: 'Die Bindung an eine Beschlagnahme macht den Kredit zum echten Notkredit.',
  },
  'adr023-repay12': {
    scenario: sc('adr023-repay12', 'wie adr023-loan100k-bust, repay_factor 1,2', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true, loanAfterConfiscation: true }),
    overrides: { 'loan_shark.repay_factor': 1.2 },
    hypothesis: 'Ein Aufschlag von 20 % verlängert die Tilgung, ohne Sackgassen zu erzeugen.',
  },
  'adr023-loanwhite': {
    scenario: sc('adr023-loanwhite', 'wie adr023-loan100k, Kredit wird aufs Bankkonto (Weißgeld) gezahlt [Design]', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true, loanToBank: true }),
    hypothesis: 'Als Weißgeld kann der Kredit nicht beschlagnahmt werden; die Schuldenfalle verschwindet.',
  },
  'adr023-loan1k-200': {
    scenario: sc('adr023-loan1k-200', 'wie adr023-loan1k, Schwelle 200 € statt 2 000 €', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true, loanShark: true }),
    overrides: { 'loan_shark.amount': 100_000, 'loan_shark.max_assets': 20_000 },
    hypothesis: 'Mit niedriger Schwelle wird der kleine Kredit nur noch in echter Not genommen, ohne dass Sackgassen zunehmen.',
  },
  'adr023-w0-085': {
    scenario: sc('adr023-w0-085', 'wie adr023, W0-Kurs 0,70–1,00 (Ø 0,85) statt 0,40–1,00 (Ø 0,70)', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true }),
    overrides: { 'laundering.tiers.gambling.rate_min': 0.7 },
    hypothesis: 'Ein günstigerer Einstiegskurs macht Waschen gegenüber dem Kontrollrisiko (2–6 % je Fahrt) lohnend und senkt Sackgassen.',
  },
  'adr023-w0narrow': {
    scenario: sc('adr023-w0narrow', 'wie adr023, W0-Kurs 0,55–0,85 (gleicher Mittelwert 0,70)', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true }),
    overrides: { 'laundering.tiers.gambling.rate_min': 0.55, 'laundering.tiers.gambling.rate_max': 0.85 },
    hypothesis: 'Die Spanne beeinflusst nur die Streuung, nicht Sackgassen oder Median.',
  },
  'adr023-xp10': {
    scenario: sc('adr023-xp10', 'wie adr023, professions.finanzen_xp_per_eur 0,001 → 0,01', 90, 12, 30, { ...BASE_OPTIONS, adr023: true, laundering: true }),
    overrides: { 'professions.finanzen_xp_per_eur': 0.01 },
    hypothesis: 'Mit 10-facher Finanzen-XP erreichen aktive Spieler W1 (L2) in Wochen statt nie; die Wäsche-Progression wird erlebbar.',
  },
  'h-control': {
    scenario: sc('h-control', 'Hypothese: travel.control_base 0,02 → 0,015', 90, 12, 30),
    overrides: { 'travel.control_base': 0.015 },
    hypothesis: 'Weniger Kontrollen helfen vor allem risikoarmen Spielern (A) und reduzieren Totalverluste (C).',
  },
};
