# Balancing & Simulation

> Verantwortlich: **Agent 6 – Game Balancing & Simulation Engineer**
> Status: **Konzept v0.1** (2026-11-08) – noch kein Simulationscode.

Dieser Ordner beschreibt, **wie** wir die Spielwirtschaft von Drogendealer-Reboot ausbalancieren und mit
automatisierten Simulationen absichern. Grundlage ist eine **persistente Multiplayer-Welt** mit
Echtzeit-Ticks (1 Tick = 10 min, 144 Ticks = 1 Tag) laut Game-Design von Agent 2.

## Dokumente

| Datei | Inhalt |
|---|---|
| [balancing-concept.md](balancing-concept.md) | Kern: die sieben Balancing-Fragen mit Modell, Messgrößen, Zielkorridoren, Szenarien und Stellschrauben |
| [player-archetypes.md](player-archetypes.md) | Simulierte Spielertypen (Bots) inkl. adversarialer Exploit-Bots |
| [exploit-catalog.md](exploit-catalog.md) | Bekannte Exploit-Klassen mit Invariante, Gegenmaßnahme und automatischem Test |
| [simulation-spec.md](simulation-spec.md) | Technische Spezifikation der Simulations-Engine (Architektur, Szenarien, Outputs, CI) |

## Rollenabgrenzung

| Wer | Verantwortet | Artefakt |
|---|---|---|
| Agent 2 – Game Designer | Formeln und **Parameterwerte** | `docs/game-design/*.md`, `docs/game-design/parameters.toml` |
| **Agent 6 – Balancing** | **Zielkorridore (KPIs)**, Simulation, Befunde, **Änderungsvorschläge** für Parameter | `docs/balancing/*`, später `sim/` |
| Agent 3 – Backend | Implementierung der Formeln als reine Domain-Funktionen | `backend/` |
| Agent 5 – Datenbank | Ledger, aus dem sich jede Preis- und Geldänderung rekonstruieren lässt (Kalibrierung) | DB-Schema |

Grundsatz: **Agent 6 setzt keine Spielparameter selbst.** Alle Zahlenwerte stehen ausschließlich in
`parameters.toml`. Agent 6 definiert, *welches Ergebnis* die Parameter erzeugen sollen, misst es per
Simulation und schlägt Änderungen per Pull Request an Agent 2 vor.

## Balancing-Workflow

```
 parameters.toml ──► Simulation (N Seeds × Szenarien) ──► KPI-Report (Ampel)
        ▲                                                       │
        │            Änderungsvorschlag (PR an Agent 2)         │ rot/gelb
        └───────────────────────────────────────────────────────┘
```

1. **Hypothese**: Ein KPI liegt außerhalb seines Zielkorridors (Simulation, Live-Telemetrie oder Spieler-Feedback).
2. **Sensitivitätsanalyse**: Ein Parameter-Sweep zeigt, welche Stellschrauben den KPI am stärksten bewegen.
3. **Vorschlag**: Minimale Parameteränderung, die den KPI in den Korridor bringt, **ohne** andere KPIs rot zu färben.
4. **Review** durch Agent 2 (Design-Intention) und Agent 1 (Gesamtsystem).
5. **Regression**: Der nächtliche CI-Lauf `balance-check` hält alle Korridore dauerhaft grün.

## KPI-Glossar (Kurzfassung)

| Kürzel | Bedeutung |
|---|---|
| `NW(t)` | Nettovermögen eines Spielers zum Zeitpunkt t (Schwarz- + Weißgeld + Warenwert + Sachwerte) |
| `IPH` | Einkommen pro aktiver Spielstunde (Income per Hour) |
| `TTM(m)` | Zeit bis Meilenstein m (Time to Milestone), in Spieltagen |
| `RDI` | Route-Dominanz-Index = Gewinn/Tick der besten Route ÷ Median der profitablen Routen |
| `Slip(q)` | Durchschnittliche Preisverschlechterung einer Order der Menge q |
| `T½` | Halbwertszeit der Preiserholung nach einem Schock |
| `Gini` | Gini-Koeffizient des Nettovermögens aktiver Spieler |
| `Top1%` | Vermögensanteil des reichsten Prozents |
| `GAP14` | IPH eines Neulings an Tag 14 ÷ IPH eines Veteranen |
| `VLQ` | Victim-Loss-Quote: PvP-Verlust pro Tag ÷ Tageseinkommen des Opfers |
| `SFR` | Sink/Faucet-Ratio: Geldsenken ÷ Geldquellen pro Tag, serverweit |

Die vollständigen Definitionen und Zielkorridore stehen in [balancing-concept.md](balancing-concept.md).
