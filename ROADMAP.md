# ROADMAP.md – Meilensteine

> Gepflegt von Agent 1. Revision 2 (2026-11-08): neu ausgerichtet auf Echtzeit-Mehrspieler (ADR-006).
> Ein Meilenstein ist erreicht, wenn **alle Exit-Kriterien** erfüllt und von Agent 1 abgenommen sind.

| MS | Titel | Status | Tasks |
|----|-------|--------|-------|
| M0 | Integration & Fundament | in Arbeit | T-001 – T-008 |
| M1 | Wirtschaftskern (Markt, Handel, Ticks) | geplant | T-101 – T-107 |
| M2 | Reisen & Spielerfortschritt | geplant | T-201 – T-204 |
| M3 | MVP spielbar (Frontend vollständig angebunden) | geplant | T-301 – T-304 |
| M4 | Kampf, Clans, Soziales | geplant | T-401 – T-404 |
| M5 | Immobilien, Ereignisse, Ranglisten, Balancing | geplant | T-501 – T-504 |
| M6 | Betrieb & Release | geplant | T-601 – T-604 |

---

## M0 – Integration & Fundament
- **Ziel:** Die parallel entstandenen Grundlagen aller Agenten liegen konsistent auf einem gemeinsamen Hauptbranch.
- **Exit-Kriterien:** GitHub-Zugriff funktioniert; Steuerungsdokumente, Game-Design-Grundlagen, Backend-Fundament (Auth + Schema), Datenmodell-Review und Frontend-Gerüst sind gemergt; CI für Backend und Frontend grün; Root-README konsolidiert.
- **Abhängigkeiten:** Schreibzugriff der Agenten auf GitHub (derzeit blockiert, siehe TASKS.md T-001).

## M1 – Wirtschaftskern
- **Ziel:** Städte, Waren, Marktpreise mit Tick-Aktualisierung, Kaufen/Verkaufen, vollständige Nachvollziehbarkeit jeder Preisänderung.
- **Exit-Kriterien:** Preisformeln aus Agent 2s Dokumentation implementiert und gegen dessen Prüfskript getestet; Preisänderungsjournal erklärt jeden Preis; Handels-Endpunkte mit Positiv-/Negativtests; Tick-Job idempotent.
- **Abhängigkeiten:** M0.

## M2 – Reisen & Spielerfortschritt
- **Ziel:** Fahrzeuge, Reisen mit Echtzeit-Timer, Kapazität, Spielerstatus.
- **Exit-Kriterien:** Reise starten/ankommen (lazy und per Tick) getestet; Statusübergänge validiert; API-Vertrag aktualisiert.
- **Abhängigkeiten:** M1 (Städte, Inventar).

## M3 – MVP spielbar
- **Ziel:** Ein Mensch kann sich registrieren, handeln, reisen und die Rangliste sehen, alles im Browser gegen das echte Backend.
- **Exit-Kriterien:** Alle MVP-Funktionen aus PROJECT.md §4 ohne Mocks bedienbar; Fehlermeldungen aus dem API-Fehlerformat verständlich; mobil nutzbar.
- **Abhängigkeiten:** M1, M2. Frontend-Seiten können vorher gegen MSW-Mocks entstehen.

## M4 – Kampf, Clans, Soziales
- **Ziel:** Spielerkampf mit Ausrüstung, Clans mit Rollen und Einladungen, Nachrichten.
- **Exit-Kriterien:** Regeln aus Agent 2s Dokumentation umgesetzt und getestet; Missbrauchsschutz (Rate-Limits, Schutz für Neulinge laut Game Design).
- **Abhängigkeiten:** M3.

## M5 – Immobilien, Ereignisse, Ranglisten, Balancing
- **Ziel:** Restliche Spielsysteme und eine ausgewogene Wirtschaft.
- **Exit-Kriterien:** Simulationswerkzeug (Agent 6) zeigt stabile Wirtschaft über eine Saison; keine dominante Strategie laut Balancing-Bericht.
- **Abhängigkeiten:** M1 (Simulation kann früher beginnen), M4.

## M6 – Betrieb & Release
- **Ziel:** Öffentlicher Betrieb.
- **Exit-Kriterien:** Hosting entschieden (Q8), Deployment automatisiert, Backups, Monitoring, Impressum und Datenschutzerklärung vorhanden (Q9), Sicherheits-Review bestanden.
- **Abhängigkeiten:** M3 (Soft-Launch möglich), M4, M5.

---

## Parallelisierung

```
M0 ─► M1 (Backend + Agent 5 + Agent 2) ─► M2 ─► M3 ─► M4 ─► M5 ─► M6
         │                                       ▲
         ├─► Frontend-Seiten gegen MSW (Agent 4) ─┘
         └─► Simulation gegen Parameterdatei (Agent 6) ─► Balancing in M5
```
