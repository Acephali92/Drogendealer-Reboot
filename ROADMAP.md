# ROADMAP.md – Meilensteine

> Gepflegt von Agent 1. Keine festen Termine, solange das Agenten-Team nicht feststeht.
> Ein Meilenstein ist erreicht, wenn **alle Exit-Kriterien** erfüllt und von Agent 1 abgenommen sind.

| Meilenstein | Titel | Status | Tasks |
|-------------|-------|--------|-------|
| M0 | Projekt-Setup | geplant | T-001 – T-003 |
| M1 | Core-Spiellogik | geplant | T-004 – T-009 |
| M2 | Spielbare UI (MVP) | geplant | T-010 – T-012 |
| M3 | Content & Balancing | geplant | T-013 – T-014 |
| M4 | Persistenz & Polish | geplant | T-015 – T-016 |
| M5 | Release 1.0 | geplant | T-017 |

---

## M0 – Projekt-Setup
- **Ziel:** Lauffähiges, leeres TypeScript/Vite-Projekt mit Qualitäts-Pipeline.
- **Exit-Kriterien:** `npm run dev`, `lint`, `typecheck`, `test`, `build` laufen; CI ist grün; Importregeln aus ARCHITECTURE.md §2 werden per Lint geprüft.
- **Abhängigkeiten:** keine.

## M1 – Core-Spiellogik
- **Ziel:** Vollständig headless spielbares Spiel in `src/core`.
- **Exit-Kriterien:** Ein Test spielt eine komplette Partie mit festem Seed von Tag 1 bis Spielende deterministisch durch; alle Commands getestet; Coverage ≥ 90 %.
- **Abhängigkeiten:** M0. Klärung von Q3 (Spieldauer/Siegbedingung) aus PROJECT.md.

## M2 – Spielbare UI (MVP)
- **Ziel:** Ein Mensch kann im Browser eine komplette Partie spielen.
- **Exit-Kriterien:** Alle MVP-Features aus PROJECT.md §4 bedienbar; Fehlermeldungen bei ungültigen Aktionen; Spielende-Bildschirm.
- **Abhängigkeiten:** M1 (Schnittstellen `reduce`, `createNewGame` stabil). UI kann parallel gegen Mock-State starten, sobald T-005 fertig ist.

## M3 – Content & Balancing
- **Ziel:** Endgültige Spielwelt mit eigenen Orten, Waren und Ereignissen; ausgewogene Wirtschaft.
- **Exit-Kriterien:** Content gemäß beantworteten Q1/Q2/Q4; Simulationsskript zeigt, dass Durchschnittsstrategien weder trivial gewinnen noch chancenlos sind.
- **Abhängigkeiten:** M1; Content-Arbeit (T-013) kann ab T-005 parallel beginnen.

## M4 – Persistenz & Polish
- **Ziel:** Speichern/Laden, Highscores, UX-Feinschliff.
- **Exit-Kriterien:** Spielstand übersteht Neuladen; Migration von `schemaVersion` getestet; responsive Darstellung auf Mobilgeräten.
- **Abhängigkeiten:** M2.

## M5 – Release 1.0
- **Ziel:** Öffentlich spielbare Version.
- **Exit-Kriterien:** Deployment als statische Seite; README mit Spielanleitung; keine offenen Bugs mit Priorität hoch.
- **Abhängigkeiten:** M2–M4.

---

## Parallelisierung (Übersicht)

```
M0 ──► M1 (core) ─────────────────────► M2 abschließen ─► M4 ─► M5
          │ T-005 fertig
          ├──► UI-Entwicklung gegen Mock (M2) ─┘
          └──► Content-Entwurf (M3) ──► Balancing nach M1
```
