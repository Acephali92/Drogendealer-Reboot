# Balancing & Simulation

> Verantwortlich: **Agent 5 – Game Balancing & Simulation Engineer** (laut Product Owner gibt es fünf Agenten; `PROJECT.md` führt die Rolle noch als „Agent 6“).
> Stand: 2026-11-09 · Basis: `main` mit Game Design (PR #4), Backend inkl. `backend/src/domain/` (PR #2/#6/#8/#9), ADR-001…019.

Dieser Ordner beschreibt die Spielökonomie von Drogendealer-Reboot fachlich, misst sie mit einer reproduzierbaren Simulation (`sim/`) und leitet daraus Balancing-Entscheidungen ab.

## Dokumente

| Datei | Inhalt |
|---|---|
| [GAME_BALANCING.md](GAME_BALANCING.md) | **Einstieg:** Ist-Analyse A–E, Designziele, KPIs mit Zielkorridoren, die sieben Balancing-Fragen, Risiko/Belohnung, Befunde und Empfehlungen |
| [GAME_ECONOMY.md](GAME_ECONOMY.md) | Wirtschaftsmodell: Angebot/Nachfrage, Preisarten, Ereignisse, wirtschaftliche Eigendynamik, Geldquellen/-senken, Anforderungen an die Umsetzung |
| [MARKET_SIMULATION.md](MARKET_SIMULATION.md) | Simulation: Architektur, Bedienung, Spielerprofile A–E, adversariale Bots, Szenarien, Metriken, CI |
| [NPC_BEHAVIOR.md](NPC_BEHAVIOR.md) | NPC-Typen, Verhalten, Intensität k und Rückbau (R-4) |
| [PROGRESSION_MODEL.md](PROGRESSION_MODEL.md) | Startkapital, Wachstumsphasen, Entwicklungsleiter, Rückschläge ohne Sackgasse, Langzeitziele, vermögensabhängige Senken |
| [BALANCING_PARAMETERS.md](BALANCING_PARAMETERS.md) | Parameterverzeichnis (generiert aus `parameters.toml`) und Änderungsprotokoll |
| [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) | Alle Simulationsläufe mit Hypothese, Setup, Messwerten und Auswertung |
| [exploit-catalog.md](exploit-catalog.md) | Anhang: Exploit-Klassen mit Invariante, Gegenmaßnahme und Test |

## Zuständigkeit

Entscheidung des Product Owners vom 2026-11-09: Die Zuständigkeit ist **nach Systemen geteilt**.

| Bereich | Fachlich verantwortlich | Technische Umsetzung |
|---|---|---|
| Spielökonomie, Preise, Angebot/Nachfrage, Warenverfügbarkeit, Marktdynamik, Wirtschaftsereignisse, NPC-Verhalten (Markt), Progression, Schwierigkeit, Risiko/Belohnung, Langzeitmotivation, Simulation | **Agent 5 (Balancing)** | Agent 3 (Backend) |
| Kampf, Clans, Geldwäsche, Immobilien, Weltraum, Reisen/Kontrollen | Agent 2 (Game Design) | Agent 3 |
| `docs/game-design/parameters.toml` (Datei) | Agent 2 pflegt die Datei. Änderungen in den Wirtschafts-/NPC-Abschnitten bringt Agent 5 per PR ein und stimmt sie mit Agent 2 ab. | – |

Die ADR dazu muss Agent 1 noch anlegen.

Werte stehen **nur** in `parameters.toml`. Noch nicht beschlossene Vorschläge stehen in `sim/proposals.toml` und werden ausschließlich in Simulationsvarianten genutzt.

## Arbeitsweise

Jede größere Balancing-Änderung durchläuft dieselben Schritte:

1. Problem identifizieren.
2. Ursache analysieren.
3. Hypothese formulieren.
4. Erwartete Wirkung beschreiben.
5. Simulieren.
6. Auswerten.
7. **Genau einen** Parameter anpassen.
8. Erneut simulieren.
9. Dokumentieren.
10. Mit Agent 1 und Agent 3 abstimmen.

Jedes Experiment in `sim/src/scenarios.ts` ändert genau eine Sache gegenüber der Basis.

**Kennzeichnung in allen Dokumenten:**

| Marke | Bedeutung |
|---|---|
| **[gemessen]** | Ergebnis eines Simulationslaufs, siehe [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) |
| **[Regel]** | beschlossene Formel oder beschlossener Wert in `docs/game-design/` |
| **[Design]** | Vorschlag von Agent 5, noch nicht beschlossen |
| **[Annahme]** | Modellannahme der Simulation |
| **[Hypothese]** | noch ungetestete Erwartung |

## Simulation in drei Befehlen

```bash
cd sim && npm ci
```

```bash
npm test
```

```bash
npm run sim -- run base-short
```

Mehr dazu in [MARKET_SIMULATION.md §2](MARKET_SIMULATION.md#2-bedienung).

## Abdeckung des Auftrags

| Auftrag | Wo |
|---|---|
| Phase 1 – Analyse A–E | [GAME_BALANCING.md §1](GAME_BALANCING.md#1-ist-analyse) |
| Phase 2 – Angebot/Nachfrage, Preise, Dynamik | [GAME_ECONOMY.md](GAME_ECONOMY.md) |
| Phase 3 – NPC- und Marktsimulation | [NPC_BEHAVIOR.md](NPC_BEHAVIOR.md), [MARKET_SIMULATION.md](MARKET_SIMULATION.md) |
| Phase 4 – Progression und Balance | [PROGRESSION_MODEL.md](PROGRESSION_MODEL.md), [GAME_BALANCING.md](GAME_BALANCING.md) |
| Phase 5 – Simulation A–E, kurz- und langfristig | [SIMULATION_RESULTS.md](SIMULATION_RESULTS.md) |
| Phase 6 – Parameterverzeichnis | [BALANCING_PARAMETERS.md](BALANCING_PARAMETERS.md) |
| Phase 7 – Dokumentation | dieser Ordner |
| Verantwortungsbereiche 1–4 (Ökonomie, Preise, Angebot/Nachfrage, Verfügbarkeit) | GAME_ECONOMY §2–3 |
| 5 NPC-Verhalten | NPC_BEHAVIOR |
| 6–7 Marktdynamik, Ereignisse | GAME_ECONOMY §4–5 |
| 8–9 Progression, Schwierigkeitskurven | PROGRESSION_MODEL |
| 10 Risiko/Belohnung | GAME_BALANCING §4 |
| 11 Langzeitmotivation | PROGRESSION_MODEL §7–8 |
| 12 Simulationstests | MARKET_SIMULATION, SIMULATION_RESULTS, `sim/test/` |

## Definition of Done – Stand

| Kriterium | Stand |
|---|---|
| 1–4 Funktion, Wirkung, Parameter, Abhängigkeiten | erfüllt für Handel, Preise, Ereignisse, NPC-Händler, Reisen/Kontrollen |
| 5 Spielertypen getestet | erfüllt (A–E, 10–150 Spieler) |
| 6 Langfristige Auswirkungen | erfüllt (365 Tage) |
| 7 Nachvollziehbar | erfüllt (Seeds, Parameter-Hash, deterministisch) |
| 8 Agent 3 bestätigt Umsetzung | **offen**: Das Backend hat noch keine Wirtschaftsregeln (`backend/src/domain/` enthält nur RNG, Geld und Zeit) |
| 9 Keine kritischen Balancing-Probleme | **offen**: siehe kritische Befunde in [GAME_BALANCING.md §6](GAME_BALANCING.md#6-befunde-und-empfehlungen) |
