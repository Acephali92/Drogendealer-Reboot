# Spezifikation: Balancing-Simulation

> Agent 6 · Konzept v0.1 · Stand 2026-11-08 · **Noch nicht implementiert.**
> Dieses Dokument ist die Vorlage für die spätere Umsetzung (Ordner `sim/`).

## 1. Ziele

1. Die sieben Balancing-Fragen aus [balancing-concept.md](balancing-concept.md) **reproduzierbar** und **automatisiert** beantworten.
2. **Denselben Code** simulieren, der im Spiel läuft. Keine zweite, auseinanderlaufende Implementierung der Formeln.
3. Jede Parameteränderung in `parameters.toml` gegen alle Zielkorridore prüfen (Regression im CI).
4. Schnell genug für Parameter-Sweeps: **1.000 Bots × 30 Tage (4.320 Ticks) in < 60 s** auf einem CI-Runner.

## 2. Technologie (Vorschlag zur Abstimmung mit Agent 1 / Agent 3)

| Entscheidung | Vorschlag | Begründung |
|---|---|---|
| Sprache | **TypeScript** (Node.js LTS) | Gleicher Stack wie das Backend (Agent 3). Die Domain-Funktionen werden direkt importiert. |
| Formel-Quelle | Reine Domain-Funktionen aus `backend/src/domain/` (Name abzustimmen) | Simulation = Live-Logik. Keine Drift. |
| Parameter | `docs/game-design/parameters.toml` über einen TOML-Parser (z. B. `smol-toml`) | Single Source of Truth (Agent 2) |
| Referenz | `docs/game-design/tools/verify.py` (Agent 2) | Die `EX-*`-Beispiele werden als **Golden Vectors** exportiert (JSON) und von Vitest gegen die TS-Domain-Funktionen geprüft. |
| Tests | Vitest | wie Backend |
| Auswertung | CSV/JSON-Export, Markdown-Report. Optional Notebook (Python/pandas) für Ad-hoc-Analysen | Die Auswertung ist vom Kern entkoppelt. |
| Parallelisierung | `worker_threads`, ein Seed pro Worker | Monte-Carlo ist trivial parallelisierbar. |

### Anforderungen an andere Module

| An | Anforderung |
|---|---|
| Agent 3 (Backend) | Die Spiellogik ist in **reinen Funktionen ohne I/O** gekapselt, z. B. `applyTick(world, params, rng) → world'` und `execute(world, playerId, command, params, rng) → {world', events}`. Prisma, Fastify und Uhrzeit liegen in einer äußeren Schicht. |
| Agent 3 | **Seedbarer, deterministischer RNG** mit Ableitung pro Entität: `rng = derive(serverSeed, tick, entityId)`, wie von Agent 2 vorgesehen |
| Agent 3 | Jede Order schreibt den Marktbestand **sofort** fort (Annahme A-3) |
| Agent 2 | Formel-IDs (`F-*`) und Beispiel-IDs (`EX-*`) sind stabil. `verify.py` kann die Beispiele als JSON exportieren. |
| Agent 5 (DB) | Das Ledger enthält pro Buchung den **Typ der Quelle bzw. Senke** (Enum wie in §1 des Konzepts) und pro Preisänderung den **Grund** (Order, Tick-Reversion, Event, Rauschen). So lässt sich die Simulation mit Live-Daten kalibrieren. |

## 3. Architektur

```
sim/
  src/
    engine/
      world.ts          Weltzustand in Memory (aus Domain-Typen)
      loop.ts           Tick-Schleife: Bots entscheiden → execute() → applyTick() → Metriken → Invarianten
      rng.ts            Re-Export des Domain-RNG
    bots/
      policies/         casual.ts, trader.ts, optimizer.ts, smuggler.ts, raider.ts,
                        investor.ts, clan.ts, newbie.ts, veteran.ts
      adversarial/      roundtrip.ts, pumpdump.ts, multiaccount.ts, ticktimer.ts, rounding.ts,
                        canceller.ts, shield.ts, washloop.ts, eventfarmer.ts, lootfarm.ts
      activity.ts       Aktivitätsprofile (Sitzungen pro Tag, Länge, Tageszeit)
    metrics/
      collectors.ts     Pro-Tick- und Pro-Tag-Metriken
      kpis.ts           KPI-Berechnung (Gini, RDI, VLQ, GAP14, SFR …)
      invariants.ts     I-1 … I-5
    scenarios/          *.scenario.ts (siehe §5)
    report/
      csv.ts json.ts markdown.ts   Ausgabe + Ampel gegen targets.toml
    cli.ts              `sim run <scenario> --seeds 20 --days 30 --override economy.elasticity=0.4`
  targets.toml          Zielkorridore aus balancing-concept.md (maschinenlesbar)
  test/                 Golden Vectors, Invarianten-Property-Tests
```

### Ablauf eines Ticks

```
for tick in 0 .. days*144:
    for bot in bots (in zufälliger, seed-abhängiger Reihenfolge):
        if bot.isOnline(tick) and bot.isIdle():
            cmd = bot.policy.decide(view(bot), publicView(world), rng(bot, tick))
            if cmd: world, events = execute(world, bot.id, cmd, params, rng(bot, tick))
    world = applyTick(world, params, rng(world, tick))   # Reihenfolge laut Agent 2
    metrics.collect(world, events, tick)
    invariants.check(world, ledger, tick)                 # Verletzung → Abbruch mit Repro-Seed
```

Die zufällige Reihenfolge der Bots pro Tick verhindert einen systematischen Vorteil für den ersten Bot in der Liste.

## 4. Szenario-Definition

```ts
export default defineScenario({
  id: 'S1-growth',
  seeds: 20,
  days: 365,                                  // keine Resets (R-2) → Langzeit
  population: { casual: 0.40, trader: 0.20, optimizer: 0.05, smuggler: 0.08,
                raider: 0.07, investor: 0.08, newbie: 0.10, veteran: 0.02 },
  size: 30,                                   // anfangs wenige Spieler (R-1)
  scaleVariants: [10, 100, 300],              // Skalierungsprüfung
  npc: { traders: 'auto', targets: 'auto' },  // N-1/N-2, Stärke abhängig von der Spielerzahl
  clans: { share: 0.4, sizes: [3, 8] },
  joinSchedule: [{ day: 0, count: 30 }],      // oder späterer Zustrom
  overrides: {},                              // Parameter-Overrides
  kpis: ['NW', 'IPH', 'r', 'TTM', 'SFR', 'M', 'basketIndex'],
});
```

**Sweeps:** `sweep: { 'economy.elasticity': [0.35, 0.5, 0.65], 'trade.spread_base': [0.06, 0.1, 0.14] }`
als Grid oder `lhs: { samples: 50 }` (Latin Hypercube). Ausgabe ist eine Sensitivitätstabelle (Einfluss jedes Parameters auf jeden KPI).

## 5. Szenario-Katalog

| ID | Frage | Bots | Dauer × Seeds | Läuft |
|---|---|---|---|---|
| `S1-growth` | 1 Vermögen, Inflation | Standard-Mix, 30 (+ Varianten 10/100/300) | 365 d × 20 | nächtlich |
| `S2a-route-matrix` | 2 Routen (statisch) | keine | – (deterministisch) | jeder PR |
| `S2b-route-saturation` | 2 Sättigung | N ∈ {1, 3, 5, 10, 25} × T2, mit/ohne NPC-Händler | 7 d × 10 | nächtlich |
| `S3a-impact-sweep` | 3 Preis-Impact | keine (Order-Sweep) | 1 d | jeder PR |
| `S3b-cornering` | 3, 6 Marktmacht | 1 Wal (T3, 10 Mio. €) + 50 × T2 | 14 d × 10 | nächtlich |
| `S4-progression` | 4 Kapitalbedarf | je 50 × T1, T2, T4, T6, T8, T9 | 120 d × 10 | nächtlich |
| `S5-raids` | 5 Überfälle | 25 Händler (T1/T2/T6) + 5 × T5, mit/ohne NPC-Ziele | 30 d × 20, Sweep über `loot_cash_rate` × `alpha` | nächtlich |
| `S6-late-joiner` | 6 Dominanz | Standard-Mix 30 inkl. T7-Clans, + je 10 × T8 an Tag 30, 180, 365 | 395 d × 10 | wöchentlich |
| `S7-roundtrip` | 7 | X1 | 1 d | jeder PR |
| `S7-pumpdump` | 7 | X2 + 50 × T2 | 14 d × 10 | nächtlich |
| `S7-multiaccount` | 7 | X3 (k = 1, 3, 5) + Standard-Mix | 30 d × 10 | nächtlich |
| `S7-ticktimer` | 7 | X4, X5 | 1 d | jeder PR |
| `S7-cancel` | 7 | X6 | 3 d | jeder PR |
| `S7-shield` | 5, 7 | X7 + 10 × T5 | 30 d × 10 | nächtlich |
| `S7-washloop` | 7 | X8 | 30 d × 5 | nächtlich |
| `S7-events` | 7 | X9 + 50 × T2 | 30 d × 10 | nächtlich |
| `S7-lootfarm` | 7 | X10 + 10 × T5 | 30 d × 10 | nächtlich |

X11 (`concurrency`) gehört nicht in die In-Memory-Simulation, sondern in die Integrationstests des Backends (E-07).

**Abdeckung der Spielertypen:** T1–T9 (inkl. T7 in S6 und S1) sowie X1–X10 kommen jeweils in mindestens einem Szenario vor.

## 6. Ausgaben

| Datei | Inhalt |
|---|---|
| `out/<scenario>/<seed>/ticks.csv` | pro Tick: Preise je Markt, Bestände, M(t), Quellen und Senken nach Typ |
| `out/<scenario>/<seed>/players.csv` | pro Tag und Bot: NW, Bargeld, Bank, IPH, Level, Heat, PvP-Verluste |
| `out/<scenario>/summary.json` | KPIs aggregiert über die Seeds (Median, P10, P90, Konfidenzintervall) |
| `out/<scenario>/report.md` | KPI-Tabelle mit Ampel gegen `targets.toml`, Diagramme (NW-Kurven, Lorenzkurve, Preisverläufe) |

**Ampel:** 🟢 im Korridor · 🟡 innerhalb von 10 % außerhalb · 🔴 weiter außerhalb oder eine Invariante verletzt.

## 7. CI-Integration

| Job | Auslöser | Inhalt | Fehler, wenn |
|---|---|---|---|
| `sim-fast` | jeder PR, der `parameters.toml`, `backend/src/domain/**` oder `sim/**` ändert | Golden Vectors, S2a, S3a, S7-roundtrip, S7-ticktimer, S7-cancel | Invariante verletzt oder KPI 🔴 |
| `balance-check` | nächtlich | alle nächtlichen Szenarien | KPI 🔴. Der Report wird als Artefakt angehängt. |
| `balance-weekly` | wöchentlich | S6, große Sweeps | nur Report, kein Fehler |

Alle Jobs laufen in **GitHub Actions**, nie auf dem Produktionsserver (VPS, ADR-014).

Jede Invariantenverletzung gibt **Szenario, Seed und Tick** aus und ist damit lokal reproduzierbar:
`sim run S7-washloop --seed 1234 --until-tick 5021`.

## 8. Umsetzungsphasen

| Phase | Inhalt | Voraussetzung | Beantwortet |
|---|---|---|---|
| P0 | Golden Vectors aus `verify.py`, `targets.toml`, Engine-Grundgerüst, S2a, S3a | Formeln von Agent 2, Domain-Modul von Agent 3 | 2, 3 (statisch) |
| P1 | Wirtschaft, Handel, Reisen. Bots T1–T4, T8, T9. S1, S2b, S3b, S4 | Domain: Markt, Handel, Reisen | 1, 2, 3, 4 |
| P2 | Kampf. Bot T5. S5 | Domain: Kampf | 5 |
| P3 | Clans, Geldwäsche, Immobilien, Weltraum. Bots T6, T7. S6 | Domain: diese Systeme | 6 |
| P4 | Adversariale Bots X1–X10, alle S7-Szenarien | P1–P3 | 7 |
| P5 | Kalibrierung: Aktivitätsprofile und Population aus Live-Telemetrie (Ledger), Abgleich Sim gegen Realität | Live-Betrieb | alle |

## 9. Grenzen des Modells

- Bots bilden menschliches Verhalten nur grob nach (Soziales, Emotionen, Rache). Live-Daten sind deshalb das letzte Wort (P5).
- Clan-Diplomatie (Bündnisse, Verrat) wird nur stark vereinfacht abgebildet.
- Die Ergebnisse gelten für die simulierte Spielerzahl. Gewinnpools pro Route skalieren mit der Zahl aktiver Spieler,
  deshalb laufen die Szenarien zusätzlich mit 10, 100 und 300 Spielern (Standard: 30, R-1).
- Bei kleinen Populationen streuen die KPIs stark zwischen den Seeds. Daher ≥ 20 Seeds, und es werden Konfidenzintervalle berichtet.
- Langzeitläufe über 365+ Tage (R-2: keine Resets) sind mit 30 Bots günstig: ≈ 52.560 Ticks, Ziel < 60 s pro Seed.
