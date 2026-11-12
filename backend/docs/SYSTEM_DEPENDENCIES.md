# Systemabhängigkeiten

> Verantwortlich: Agent 3. Zeigt, welche Spielsysteme aufeinander aufbauen und welche externen Zuarbeiten sie blockieren. Task-IDs aus [`TASKS.md`](../../TASKS.md). Stand: 2026-11-09.

## 1. Externe Zuarbeiten

| Von                   | Liefert                                                                                                                                | Status                                        | Blockiert                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Agent 2 (Game Design) | `docs/game-design/parameters.toml`, Formeln (`F-*`), Golden Vectors (`verify.py`)                                                      | ✅ in `main` (PR #4); Laden umgesetzt (T-101) | T-102, T-103, T-104 sind freigeschaltet, warten aber auf Schema-Entscheidungen (B-9 bis B-15) |
| Agent 2               | Regeln für Reisen und Fahrzeuge, Kampf, Clans/Wahl, NPCs, Immobilien, Ereignisse                                                       | offen                                         | T-201 ff., T-309, T-401, T-501, T-502, T-506                                                  |
| Agent 5 (Datenbank)   | Review jeder Schemaänderung, Vorschläge in [DATA_MODELS §6](DATA_MODELS.md#6-offene-schema-vorschläge-warten-auf-review-durch-agent-5) | angefragt                                     | jede neue Migration, T-306, T-104, Idempotenz, Inventarjournal                                |
| Agent 6 (Balancing)   | Bestätigung der Domain-Schnittstellen (`execute`, `applyTick`, `deriveRng`)                                                            | angefragt                                     | Signaturen der Regelfunktionen                                                                |
| Agent 4 (Frontend)    | Bestätigung der Vertragsabweichungen                                                                                                   | offen                                         | T-107                                                                                         |
| Agent 1               | Integration in `main`, Freigaben                                                                                                       | laufend                                       | Merge                                                                                         |

## 2. Interne Abhängigkeiten (Aufbaureihenfolge)

```
                    ┌──────────────────────────────┐
                    │ Parameter laden (T-101) ✅   │◄── parameters.toml (A2)
                    └──────────────┬───────────────┘
                                   ▼
 Domain-Basis ✅ ──► Regelfunktionen (T-103) ──► Seed-Daten (T-102)
 (rng, money, time)          │                        │
                             ▼                        ▼
            Zeit/Tick-System (T-104) ◄── WorldTick-Schema (A5)
                    │
       ┌────────────┼────────────────┬─────────────────────┐
       ▼            ▼                ▼                     ▼
  Markt-Tick   Handel (T-106) ◄── Idempotenz + Inventarjournal (A5)
                    │
                    ▼
            Reisen + Status (T-202/203) ◄── Fahrzeugregeln (A2)
                    │
       ┌────────────┼────────────────┐
       ▼            ▼                ▼
   Kampf (T-401)  Clans (T-402/309)  Ranglisten (T-304/508)
       │            │
       └─────┬──────┘
             ▼
   NPCs (T-506), Ereignisse (T-502), Immobilien (T-501), laufende Kosten
```

## 3. Abhängigkeiten je System

| System                       | Braucht                                      | Wird gebraucht von                                       |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Auth/Konten ✅               | –                                            | alles Authentifizierte                                   |
| Domain-Basis ✅              | –                                            | alle Regeln, Simulation (A6)                             |
| Parameter                    | A2-Datei, Domain-Basis                       | alle Regeln, Seed, Tick                                  |
| Zeit/Tick                    | Parameter (Tick-Länge), `WorldTick`          | Markt, Reisen, Status, NPCs, Ereignisse, laufende Kosten |
| Markt/Preise                 | Parameter, Formeln, Preisjournal ✅          | Handel, NPC-Händler, Ranglisten (Vermögen inkl. Waren)   |
| Handel                       | Markt, Inventar, Geldjournal, Idempotenz     | Reisen (Kapazität), Kampf (Beute)                        |
| Inventar                     | Waren, Kapazitätsregeln, Inventarjournal     | Handel, Reisen, Kampf                                    |
| Reisen/Status                | Tick, Fahrzeuge, Städte                      | Kampf (Ort), Ereignisse, Polizeikontrollen               |
| Kampf                        | Status, Ausrüstung, Geld/Inventar            | Ranglisten, Ticker                                       |
| Clans                        | Spieler, Clan-Kasse + Journal (T-309)        | Ranglisten, Kampf (Gruppen)                              |
| NPCs                         | Tick, Markt, Kampf, Aktivitätskennzahlen (k) | Balancing                                                |
| Immobilien / laufende Kosten | Geldjournal, Tick                            | Geldsenken (T-505)                                       |
| Kontolöschung (ADR-017)      | Restrict auf Journale, Pseudonymisierung     | Datenschutz-Release                                      |

## 4. Risiken aus den Abhängigkeiten

1. **Kritischer Pfad jetzt über Agent 5.** Parameter und Formeln liegen vor (T-101 erledigt). Seed-Daten (T-102) und Markt (T-103/T-104) brauchen aber die Schema-Entscheidungen B-9 bis B-15: Schwarz-/Weißgeld, Heat pro Stadt, Volumen statt Gramm, Waren- und Stadtattribute, Bestände als Float, Clan-Ränge.
2. **Schema-Engpass über Agent 5.** Idempotenz, Inventarjournal und Tick-Tabelle sind Voraussetzung für sichere Schreibaktionen. Ohne Review keine Migration.
3. **Signaturen der Domain-Funktionen.** Werden sie nach dem Start der Simulation geändert, muss Agent 6 nachziehen (ADR-012). Deshalb vorher abstimmen.
4. **Dauerhafte Welt (ADR-016).** Jede Parameter- oder Schemaänderung trifft eine laufende Welt. Migrationen müssen Daten erhalten; Parameteränderungen brauchen später eine Versionierung.
