# TASKS.md – Aufgaben-Board

> Gepflegt von Agent 1. Agenten übernehmen Tasks, indem sie sich unter **Zuständig** eintragen
> und den Status auf `in progress` setzen. Neue Tasks nur nach Abstimmung mit Agent 1.

## Legende

**Status:** `todo` · `in progress` · `review` · `done` · `blocked`
**Bereich-Tags:** `[setup]` `[core]` `[content]` `[ui]` `[persistence]` `[qa]` `[docs]`
**Zuständig:** `unassigned`, bis die Agenten-Rollen definiert sind (PROJECT.md, Q5).

## Übersicht

| ID | Titel | Bereich | MS | Status | Zuständig | Abhängig von |
|----|-------|---------|----|--------|-----------|--------------|
| T-001 | Vite + TypeScript-Projekt aufsetzen | [setup] | M0 | todo | unassigned | – |
| T-002 | ESLint, Prettier, Importregeln | [setup] | M0 | todo | unassigned | T-001 |
| T-003 | Vitest + GitHub-Actions-CI | [setup] [qa] | M0 | todo | unassigned | T-001 |
| T-004 | Seeded RNG | [core] | M1 | todo | unassigned | T-003 |
| T-005 | GameState-, Command- & Content-Typen | [core] [content] | M1 | todo | unassigned | T-001 |
| T-006 | Markt-Preismodell | [core] | M1 | todo | unassigned | T-004, T-005 |
| T-007 | Commands: Kaufen / Verkaufen | [core] | M1 | todo | unassigned | T-005, T-006 |
| T-008 | Commands: Reisen, Tageswechsel, Schulden | [core] | M1 | todo | unassigned | T-006, T-007 |
| T-009 | Zufallsereignisse & Spielende/Scoring | [core] | M1 | blocked (Q3) | unassigned | T-008 |
| T-010 | UI-Technik evaluieren (ADR) | [ui] | M2 | todo | unassigned | T-001 |
| T-011 | Platzhalter-Content für MVP | [content] | M2 | todo | unassigned | T-005 |
| T-012 | Spielbildschirme MVP | [ui] | M2 | todo | unassigned | T-010, T-005 (Mock); Integration: T-008 |
| T-013 | Finaler Content (Welt, Waren, Events) | [content] | M3 | blocked (Q1, Q2, Q4) | unassigned | T-011 |
| T-014 | Balancing-Simulationsskript | [core] [qa] | M3 | todo | unassigned | T-009 |
| T-015 | Speichern/Laden + Migrationen | [persistence] | M4 | todo | unassigned | T-009 |
| T-016 | Highscores & UX-Polish | [ui] | M4 | todo | unassigned | T-012, T-015 |
| T-017 | Deployment & Spielanleitung | [setup] [docs] | M5 | todo | unassigned | T-016 |

---

## Task-Details

### T-001 – Vite + TypeScript-Projekt aufsetzen
- **Akzeptanzkriterien:** `package.json` mit Skripten `dev`, `build`, `preview`, `typecheck`; `tsconfig.json` mit `strict: true`; Verzeichnisstruktur gemäß ARCHITECTURE.md §5 (leere Module mit `index.ts`); `.gitignore`.

### T-002 – ESLint, Prettier, Importregeln
- **Akzeptanzkriterien:** `npm run lint` schlägt fehl, wenn `src/core` aus `src/ui` oder `src/persistence` importiert oder `Math.random`/`Date.now`/`window`/`localStorage` nutzt (ADR-003). Prettier-Konfiguration eingecheckt.

### T-003 – Vitest + GitHub-Actions-CI
- **Akzeptanzkriterien:** `npm test` mit Coverage-Report; Workflow führt `lint`, `typecheck`, `test`, `build` bei Push und PR aus (ADR-005).

### T-004 – Seeded RNG
- **Akzeptanzkriterien:** Reine Funktion `next(rngState) → { value, rngState }` plus Helfer (`int(min,max)`, `pick`, `weighted`). Tests belegen Determinismus und Verteilung grob gleichmäßig.

### T-005 – GameState-, Command- & Content-Typen
- **Akzeptanzkriterien:** Typen gemäß ARCHITECTURE.md §3–4 in `src/core/types.ts`, `src/core/commands.ts`, `src/content/types.ts`. Geld als Integer. **Schnittstellen-Freeze** nach Review durch Agent 1 – danach Änderungen nur per Abstimmung.

### T-006 – Markt-Preismodell
- **Akzeptanzkriterien:** `generateMarket(location, items, rng)` erzeugt Preise innerhalb `minPrice..maxPrice` abhängig von `volatility`. Tests für Grenzen und Determinismus.

### T-007 – Commands: Kaufen / Verkaufen
- **Akzeptanzkriterien:** `buy`/`sell` in `reduce`; Fehlercodes für zu wenig Geld, zu wenig Kapazität, nicht vorhandene Ware, ungültige Menge. Positiv- und Negativtests.

### T-008 – Commands: Reisen, Tageswechsel, Schulden
- **Akzeptanzkriterien:** `travel` erhöht `day`, berechnet Zinsen, generiert neuen Markt; `repayDebt` mit Validierung. `createNewGame(seed, config)` liefert gültigen Startzustand.

### T-009 – Zufallsereignisse & Spielende/Scoring
- **Blockiert durch:** Q3 (Spieldauer/Siegbedingung).
- **Akzeptanzkriterien:** Ereignisse gewichtet aus `content`; Status `finished` nach `maxDays`; Scoring-Funktion; End-to-End-Test einer kompletten Partie mit festem Seed (Exit-Kriterium M1).

### T-010 – UI-Technik evaluieren (ADR)
- **Akzeptanzkriterien:** Kurzer Vergleich (Vanilla DOM vs. z. B. Preact/Lit), Empfehlung als ADR-Entwurf in DECISIONS.md; Entscheidung durch Agent 1.

### T-011 – Platzhalter-Content für MVP
- **Akzeptanzkriterien:** Neutrale Platzhalter-Orte/Waren/Events, ausreichend für ein spielbares MVP; eindeutig als Platzhalter gekennzeichnet; eigenständige Namen (keine Übernahmen aus bestehenden Spielen).

### T-012 – Spielbildschirme MVP
- **Akzeptanzkriterien:** Start-, Markt-, Reise- und Endbildschirm; UI leitet alles aus `GameState` ab und sendet nur Commands; Fehlermeldungen aus `CommandError` verständlich angezeigt.

### T-013 – Finaler Content
- **Blockiert durch:** Q1, Q2, Q4.
- **Akzeptanzkriterien:** Content gemäß Product-Owner-Vorgaben; alle Texte in `src/content`.

### T-014 – Balancing-Simulationsskript
- **Akzeptanzkriterien:** Headless-Skript simuliert N Partien mit einfachen Bot-Strategien und gibt Score-Verteilung aus.

### T-015 – Speichern/Laden + Migrationen
- **Akzeptanzkriterien:** gemäß ADR-004; Tests für korrupte Daten und Migration einer älteren `schemaVersion`.

### T-016 – Highscores & UX-Polish
- **Akzeptanzkriterien:** Lokale Top-10; responsive Layout; Tastaturbedienung der Hauptaktionen.

### T-017 – Deployment & Spielanleitung
- **Akzeptanzkriterien:** Automatisches Deployment des Builds als statische Seite; README mit Anleitung.

---

## Review-Prozess (Agent 1)

Jeder PR wird von Agent 1 geprüft auf:
1. Erfüllung aller Akzeptanzkriterien des referenzierten Tasks
2. Einhaltung der Modul- und Importregeln (ARCHITECTURE.md §2)
3. Unveränderte oder abgestimmte Schnittstellenverträge (ARCHITECTURE.md §7)
4. Tests vorhanden und CI grün
5. Migrationsbedarf bei `GameState`-Änderungen (ADR-004)
6. Aktualisierte Dokumente (TASKS.md-Status, ggf. neuer ADR)

Ergebnis: `approved` → Status `done` · `changes requested` → Status zurück auf `in progress`.
