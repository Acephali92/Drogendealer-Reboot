# MARKET_SIMULATION – Simulationswerkzeug

> Agent 5 – Game Balancing & Simulation · Stand 2026-11-09 · Code: [`sim/`](../../sim) · ADR-012
> Ersetzt die frühere `simulation-spec.md` und `player-archetypes.md`.

## 1. Zweck und Prinzip

Die Simulation beantwortet Balancing-Fragen **gemessen statt geschätzt**. Dafür lässt sie Bots mit unterschiedlichem Verhalten in einer Welt mit den echten Spielregeln spielen, über 1 bis 365 Tage und mit mehreren Seeds.

| Prinzip | Umsetzung |
|---|---|
| Gleiche Regeln wie das Spiel | Formeln aus `docs/game-design/` als reine Funktionen in `sim/src/model/`. Golden-Tests reproduzieren **alle** EX-Werte von `verify.py` für Wirtschaft, Handel, Städte, Reisen, Progression und NPC-Händler. |
| Übergang (ADR-012) | `sim/src/model/` ist eine **Übergangsschicht**. Liefert Agent 3 die Regelfunktionen in `backend/src/domain/`, werden sie dort importiert und die Golden-Tests gegen beide laufen gelassen. **Erster Schritt erledigt:** Der Zufall (F-GLB-01/02) kommt bereits aus `backend/src/domain/rng.ts`. |
| Parameter nicht kopieren | Gelesen wird `docs/game-design/parameters.toml` (überschreibbar per `--params` / `SIM_PARAMS`). Vorschläge kommen aus `sim/proposals.toml`. Jeder Bericht nennt den SHA-256 beider Dateien. |
| Deterministisch | Zufall nur über F-GLB-01/02 `U(seed, t, entity, k)`. Die Implementierung wird direkt aus `backend/src/domain/rng.ts` importiert (`sim/src/rng.ts`), sie ist also dieselbe wie im Spielserver. Gleicher Seed ergibt identischen Endzustand (Test I-5). |
| Geld exakt | Integer-Cent (ADR-019). ⌈⌉ beim Zahlen, ⌊⌋ beim Erhalten. Die Geldbilanz wird **jeden Tick** geprüft (I-1). |

## 2. Bedienung

```bash
cd sim && npm ci
```

```bash
npm test
```

```bash
npm run sim -- list
```

```bash
npm run sim -- run base-short npc
```

```bash
npm run sim -- run base-short --seeds 4 --days 30 --set economy.elasticity=0.4
```

```bash
npm run sim -- registry > /tmp/registry.md
```

- `npm test` führt die Tests aus (ohne Typecheck): RNG, Golden Vectors (Sollwerte aus `backend/test/golden/golden-vectors.json`, ohne Python) und Invarianten.
- Ergebnisse landen in `sim/out/<szenario>/summary.{json,md}`. Der Ordner ist nicht versioniert. Gültige Läufe werden nach [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) übernommen.
- Die Seeds laufen parallel (`worker_threads`). 90 Tage mit 35 Spielern brauchen ≈ 6 s pro Seed.

## 3. Architektur

```text
sim/src/
  params.ts            parameters.toml + proposals.toml laden, prüfen ([bounds]), Overrides, SHA-256
  rng.ts               F-GLB-01/02 – Re-Export aus backend/src/domain/rng.ts
  model/               ÜBERGANGS-Formelschicht (→ backend/src/domain/)
    economy.ts         F-ECO-01…09
    trade.ts           F-TRD-01…06, F-PRF-03
    travel.ts          F-CTY-01…03, F-TRV-01…06, F-PRF-01/02
    npc.ts             F-NPC-01 (NPC-Händler), F-NPC-04 (Rückbau k)
    extensions.ts      [Design] F-ECO-10…14, NPC-1b, NPC-4
  world.ts             Weltzustand (8 Städte × 8 Waren = 64 Erdmärkte), Spieler, Tick, Invarianten
  bots/profiles.ts     Profile A–E, Hintergrund-Mix
  bots/decide.ts       Entscheidungslogik
  run.ts               Szenario-Lauf, Zustrom, Kennzahlen F-NPC-04, Statistik
  scenarios.ts         Experimentkatalog (§5)
  report.ts            Aggregation über Seeds, Markdown
  registry.ts          Parameterverzeichnis für BALANCING_PARAMETERS.md
  cli.ts, worker.ts    Kommandozeile, Parallelisierung
sim/test/              golden.test.ts, invariants.test.ts, rng.test.ts, golden-setup.ts
```

**Tick-Ablauf** (Reihenfolge laut Agent 2, README §4 und npc.md §5):

```text
1  Ereignisse würfeln/auslaufen                  F-ECO-09
2a NPC-Händlerflüsse (gleichzeitig)              F-NPC-01          (Variante npc)
2b Märkte: Rauschen → Bestand → Preis            F-ECO-05/04/06    (+ [Design] F-ECO-10…14, NPC-1b)
3  Reisen: vorab gewürfelte Kontrollen, Ankunft  F-TRV-04/06
4–6 Betriebe, Geldwäsche, Clans                  nicht simuliert
   Spieleraktionen: Bots, die online und nicht unterwegs sind, in seed-abhängig zufälliger Reihenfolge
   Invarianten I-1 (Geldbilanz) und I-4 (Bestände, Bargeld)
```

**Abgedeckt:** Handel, Bahn und Fahrzeuge, Fahrzeugkauf und -verkauf, Heat, Kontrollen, Bestechung, Beschlagnahme, Strafen, Schulden mit Tilgung, Verderb, Handels- und Schmuggel-XP mit Freischaltung (LKW: Schmuggel L5), Ereignisse und NPC-Händler.

**Nicht abgedeckt [Annahme: kein Einfluss auf die gemessenen Größen]:**
- Kampf, NPC-Kuriere und NPC-Banden (F-NPC-02/03)
- Clans, Geldwäsche, Betriebe, Weltraum
- die Unterscheidung von Schwarz- und Weißgeld (alles als Bargeld geführt)

Dadurch fehlen einige Geldquellen (Betriebe, Beute) und Senken (Unterhalt, Wäsche, Hehler). Das Nettovermögen enthält Bargeld − Schulden + Fahrzeugkaufpreise + Ware zu P_base.

## 4. Spielerprofile (Bots)

### 4.1 Szenarien A–E laut Auftrag

| Profil | Szenario | Aktivität | Reserve | Risikogewicht | Waren | Fahrzeuge | Bestechung | Fehlerrate | Besonderheit |
|---|---|---|---|---|---|---|---|---|---|
| **A** | Vorsichtig | 2×6 Ticks/Tag (≈ 2 h) | 50 % Bargeld | 3 × erwarteter Kontrollverlust | Heat ≤ 1,0 | ab 30 % des Bargelds | nie | 5 % | – |
| **B** | Durchschnittlich | 4×9 (≈ 6 h) | 10 % | 1 | Heat ≤ 2,0 | ab 50 % | wenn Erwartungswert besser | 10 % | – |
| **C** | Aggressiv | 6×9 | 0 % | 0,5 | alle | ab 85 % | immer | 10 % | – |
| **D** | Ineffizient | 2×6 | 5 % | 0,8 | alle | ab 95 %, Fehlkäufe | immer | **30 %** | Fehlentscheidungen auch unprofitabel, keine Leerfahrten, lernt nicht |
| **E** | Optimiert | 8×12 (≈ 16 h) | 2 % | 1 | alle | nach Amortisation | wenn Erwartungswert besser | 0 % | Rundkurse (2 Fahrten voraus) |

Aktivitätsprofil: Die Sitzungen liegen zufällig über den Tag verteilt (Seed). Reisen laufen offline weiter. Nur in Sitzungen trifft der Bot Entscheidungen.

### 4.2 Entscheidungslogik (`bots/decide.ts`)

1. **Verkaufen:** Nach der Ankunft verkauft der Bot die gesamte Ladung. Danach lernt er: `forecastBias ← 0,8 · forecastBias + 0,2 · (Ist-Erlös ÷ Erlös bei Abfahrt)`.
2. **Fahrzeug:** Der Bot kauft das nächstgrößere freigeschaltete Fahrzeug nach Budgetregel (A–D) bzw. wenn danach genug Kapital bleibt, um es halb zu füllen (E). Das alte Fahrzeug verkauft er zu 60 %.
3. **Route:** Bewertet werden alle (Ware, Ziel) ab der aktuellen Stadt mit Mengen 100/60/30 %.

   ```text
   Gewinn = Erlös_Ziel(q) · forecastBias − Kaufkosten(q) − Reisekosten − Risikogewicht · p_Kontrolle · (Erlös + Strafe)
   ```

   Bewertet wird der Gewinn je Tick (Reise + erwartete Wartezeit bis zur nächsten Sitzung). Dazu kommen Leerfahrten in bessere Startstädte (außer D) und bei E Rundkurse.
4. **Fehler:** Mit der Fehlerrate wählt der Bot eine zufällige Option, auch eine unprofitable.
5. **Sackgasse:** Wer weniger als 10 % des Startkapitals besitzt und keine Ladung hat, verkauft sein Fahrzeug, um neu anzufangen (außer D). Bleibt das ohne Erfolg, zählen **Sackgassen-Tage**.

**Informationsstand [Annahme]:** Bots sehen die aktuellen Preise aller Städte, wie es `GET /market/overview` erlaubt. Den Preisverfall bis zur Ankunft lernen sie über `forecastBias`. Ohne diesen Lernschritt (erste Version) überschätzten alle Bots ihre Erlöse um 10–30 %, und Profil A verlor systematisch Geld. Das war ein Modellfehler, kein Spielbefund (siehe [SIMULATION_RESULTS.md §0](SIMULATION_RESULTS.md#0-änderungen-am-modell)).

### 4.3 Hintergrund-Population

Der Hintergrund bildet die Standard-Population nach ADR-016 ab (30 Spieler) und verwendet dieselben Profile:

| Profil | A | B | C | D | E |
|---|---:|---:|---:|---:|---:|
| Anteil | 40 % | 28 % | 15 % | 10 % | 7 % |

Zusätzlich läuft je ein **beobachteter** Bot A–E. Gemessen werden die beobachteten Bots. Der Hintergrund sorgt für Konkurrenz und Marktbewegung.

### 4.4 Adversariale Bots (geplant, Phase P4)

| ID | Bot | Strategie | Prüft | Stand |
|---|---|---|---|---|
| X1 | `roundtrip` | Kauf und sofortiger Rückverkauf, alle Mengen und Level | E-01 | als Test umgesetzt (`invariants.test.ts`, I-3) |
| X2 | `pumpdump` | Markt aufkaufen, auf Reaktion warten, verkaufen | E-02, E-03 | offen |
| X3 | `multiaccount` | Vermögen über Zweitaccounts schieben | E-04, E-11 | offen (benötigt Kampf/Clans) |
| X4 | `ticktimer` | Order-Splitting, Handel an Tick-Grenzen | E-05 | Splitting als Test umgesetzt |
| X5 | `rounding` | Kleinstorders | E-06 | durch I-1 je Tick abgedeckt |
| X6 | `canceller` | Fahrzeug kaufen/verkaufen, Reiseabbruch | E-08 | offen |
| X7 | `shield` | Bargeld minimal, greift selbst an | E-09 | offen (Kampf) |
| X8 | `washloop` | Geldwäsche im Kreis | E-12, E-13 | offen (Geldwäsche) |
| X9 | `eventfarmer` | reist zu Ereignissen | E-14 | offen |
| X10 | `lootfarm` | kooperierende Angriffe | E-15 | offen (Kampf) |
| X11 | `concurrency` | parallele Commands | E-07 | gehört in die Backend-Integrationstests |

## 5. Szenario-Katalog

Jede Variante ändert **genau eine** Sache gegenüber `base`/`base-short`. Standard: 30 Hintergrundspieler + A–E.

| ID | Änderung | Tage × Seeds | Frage |
|---|---|---|---|
| `base` | – (Regeln von Agent 2 unverändert) | 365 × 12 | Langzeitverlauf, Gleichgewicht, Geldmenge |
| `base-short` | – | 90 × 24 | robuste Aussagen für die ersten 90 Tage |
| `npc` | NPC-Händler F-NPC-01, k = 1 | 90 × 12 | Wirkung der beschlossenen NPC-Regel |
| `npc-half` | k = 0,5 | 90 × 12 | Monotonie in k |
| `npc-ext` | [Design] Kundenbindung + Polizeidruck | 90 × 12 | Wirkung meiner NPC-Vorschläge |
| `ext` | [Design] F-ECO-10…14 | 90 × 12 | wirtschaftliche Eigendynamik |
| `safety-net` | [Design] Startkredit 1 000 € | 90 × 12 | Sackgassen |
| `h-confiscation` | [Design] Beschlagnahme 50 % statt 100 % | 90 × 12 | Sackgassen, Streuung |
| `h-elasticity` | `economy.elasticity` 0,5 → 0,4 | 90 × 12 | Wachstumstempo, Routenspreizung |
| `h-control` | `travel.control_base` 0,02 → 0,015 | 90 × 12 | Risiko/Belohnung |
| `pop-10`, `pop-100` | 10 bzw. 100 Hintergrundspieler | 90 × 12 / 8 | Skalierung (R-1) |
| `s8-handover` | Zustrom 10 → 150, NPC-Händler, k nach F-NPC-04 | 180 × 4 | Prognose für den NPC-Rückbau (R-4) |

## 6. Metriken

| Metrik | Definition |
|---|---|
| NW | Nettovermögen am Tagesende: Bargeld − Schulden + Fahrzeuge (Kaufpreis) + Ware × P_base |
| Meilensteine | Tag des ersten Erreichens: Kleinwagen, Transporter, LKW, NW ≥ 50 000 € / 500 000 € / 5 Mio. € |
| Fahrten/Tag, Kontrollquote | Kontrollen ÷ Fahrten |
| Ø Marge | Erlös_erwartet ÷ Kaufkosten − 1 je Handel (Planungssicht) |
| Einnahmen/Ausgaben | Verkauf, Einkauf, Reise, Strafen + Bestechung + Tilgung (Ledger je Kategorie) |
| Sackgassen-Tage | Zeit mit weniger als 10 % Startkapital ohne Ladung und ohne profitable Option |
| Neustarts | Fahrzeugverkäufe nach Totalverlust |
| P/P* | Tagesmittel des Marktpreises ÷ Gleichgewichtspreis, Mittel aller Märkte (Marktstabilität) |
| knappe Markt-Ticks | Anteil mit S/S_ref < 0,5 (Warenverfügbarkeit) |
| Geldmenge, SFR | Σ Bargeld aller Spieler. Senken ÷ Quellen aus dem Ledger. |
| Gini, Reichster ÷ Median | Ungleichheit am Ende. Bei < 100 Spielern ist das Rangmaß aussagekräftiger (GAME_BALANCING §3). |
| F-NPC-04-Kennzahlen | Routen-Konkurrenz (Top-10-Routen mit ≥ 2 Verkäufern in 1 008 Ticks), Marktaktivität (Märkte mit Spielerhandel in 144 Ticks), Spitzen-Online. Ziel-Verfügbarkeit PvP: nicht simuliert, als erfüllt angenommen. |

## 7. Tests und CI

| Test | Inhalt |
|---|---|
| `rng.test.ts` | Testvektor EX-GLB-01, Zustandslosigkeit |
| `golden.test.ts` | EX-GLB-01, EX-ECO-01…06, EX-TRD-01…06, EX-CTY-01…03, EX-TRV-01…04, EX-PRF-01…03, EX-NPC-01, EX-NPC-04. Sollwerte aus `backend/test/golden/golden-vectors.json` (Export von Agent 3, deckungsgleich mit `verify.py`), Fallback: Live-Export aus `verify.py`. |
| `invariants.test.ts` | I-3 Rund-Trip-Verlust (alle Märkte, Mengen, Level), E-05 Order-Splitting, Preisgrenzen, I-1/I-4 über 3 Tage mit allen Erweiterungen, I-5 Determinismus |

CI: `.github/workflows/sim.yml` (`sim-fast`: `npm ci`, Typecheck, `npm test`) bei Änderungen an `sim/`, `parameters.toml` oder `verify.py`. Der nächtliche `balance-check` (ADR-012) ist Phase P1+, Laufzeit der Basis ≈ 10 min.

## 8. Phasen

| Phase | Inhalt | Stand |
|---|---|---|
| P0 | Formelschicht, Golden Vectors, Invarianten, CI | ✅ |
| P1 | Wirtschaft, Handel, Reisen, Profile A–E, Szenarien | ✅ |
| P2 | Kampf, NPC-Kuriere/-Banden (F-NPC-02/03), Ziel-Verfügbarkeit | offen |
| P3 | Clans, Geldwäsche, Betriebe, Weltraum | offen |
| P4 | adversariale Bots X2–X10 | offen |
| P5 | Austausch der Formelschicht gegen `backend/src/domain/` + Kalibrierung mit Live-Ledger | offen (wartet auf Agent 3) |

## 9. Grenzen

- Die Bots sind rationaler und gleichförmiger als Menschen. Ergebnisse für E sind eine **Obergrenze**, für D eine Untergrenze.
- Ohne Kampf, Clans, Geldwäsche und Betriebe ist das Nettovermögen ein reines Handelsvermögen.
- **Formelschicht noch eigen:** Nur der Zufall stammt bereits aus dem Backend. Preis-, Handels-, Reise- und NPC-Formeln folgen mit T-103. Geldrundung rechnet in `sim` mit number, im Backend mit BigInt (`money.ts`). Beide sind für Beträge bis 9 · 10^15 ct gleichwertig.
