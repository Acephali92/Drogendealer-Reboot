# DECISIONS.md – Architecture Decision Records

> Gepflegt von Agent 1 (Project Director). Neue Entscheidungen werden **angehängt**, nie gelöscht.
> Überholte ADRs erhalten Status `Ersetzt durch ADR-XXX`.

Status-Werte: `Vorgeschlagen` · `Akzeptiert` · `Abgelehnt` · `Ersetzt durch ADR-XXX`

| ID | Titel | Status | Datum |
|----|-------|--------|-------|
| ADR-001 | Dokumentgetriebene Agenten-Koordination | Akzeptiert | 2026-11-08 |
| ADR-002 | TypeScript + Vite als Tech-Stack | Akzeptiert | 2026-11-08 |
| ADR-003 | Strikte Trennung Core/UI, deterministischer Core | Akzeptiert | 2026-11-08 |
| ADR-004 | Persistenz über LocalStorage mit Schema-Version | Akzeptiert | 2026-11-08 |
| ADR-005 | Vitest als Testframework | Akzeptiert | 2026-11-08 |

---

## ADR-001 – Dokumentgetriebene Agenten-Koordination
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Mehrere KI-Agenten arbeiten parallel am Projekt. Ohne gemeinsame, persistente Grundlage entstehen widersprüchliche Annahmen und Doppelarbeit.
- **Entscheidung:** Fünf Steuerungsdokumente im Repo-Root sind die einzige verbindliche Quelle: `PROJECT.md` (Was/Warum), `ARCHITECTURE.md` (Wie), `DECISIONS.md` (Warum so), `ROADMAP.md` (Wann), `TASKS.md` (Wer/Was jetzt). Agent 1 ist Eigentümer.
- **Konsequenzen:** Jede Arbeit referenziert eine Task-ID. Dokumente müssen mit dem Code synchron gehalten werden; veraltete Dokumente gelten als Bug.

## ADR-002 – TypeScript + Vite als Tech-Stack
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Zielplattform ist der Browser, kein Backend nötig. Gewünscht sind schnelle Iteration, Typsicherheit und einfache Auslieferung als statische Seite.
- **Entscheidung:** TypeScript (strict) mit Vite als Dev-Server und Bundler. Kein UI-Framework im ersten Schritt; die UI-Technik (Vanilla DOM vs. leichtgewichtiges Framework) wird in T-010 evaluiert und ggf. per eigenem ADR festgelegt.
- **Konsequenzen:** Build erzeugt statische Dateien (Hosting z. B. über GitHub Pages). Node.js LTS ist Entwicklungsvoraussetzung.

## ADR-003 – Strikte Trennung Core/UI, deterministischer Core
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Spiellogik muss testbar, balancierbar und unabhängig von der Darstellung weiterentwickelbar sein. Mehrere Agenten sollen parallel an Logik und UI arbeiten.
- **Entscheidung:** `src/core` ist reine, seiteneffektfreie Logik (`reduce(state, command, rng)`). Zufall nur über seeded RNG, dessen Zustand im `GameState` liegt. Keine DOM-, Zeit- oder Storage-Zugriffe im Core.
- **Konsequenzen:** Reproduzierbare Spiele und Tests; Balancing-Simulationen headless möglich. UI muss den gesamten Zustand aus `GameState` ableiten. Importregeln werden per Lint erzwungen.

## ADR-004 – Persistenz über LocalStorage mit Schema-Version
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Spielstände und Highscores sollen ohne Server erhalten bleiben.
- **Entscheidung:** Speicherung als JSON im `localStorage`. Jeder Spielstand enthält `schemaVersion`; `persistence` stellt Migrationen bereit. Fehlerhafte/unlesbare Stände werden verworfen, ohne das Spiel abstürzen zu lassen.
- **Konsequenzen:** Spielstände sind gerätegebunden. Jede Änderung an `GameState` erfordert Prüfung, ob eine Migration nötig ist (Review-Checkpunkt von Agent 1).

## ADR-005 – Vitest als Testframework
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Es braucht ein schnelles Testframework, das nahtlos mit Vite/TypeScript funktioniert.
- **Entscheidung:** Vitest für Unit- und Integrationstests, Coverage über `@vitest/coverage-v8`. E2E-Tests (z. B. Playwright) werden später bei Bedarf per eigenem ADR entschieden.
- **Konsequenzen:** Kein separates Babel/Jest-Setup. Core-Coverage-Ziel ≥ 90 %.

---

## Vorlage für neue ADRs

```md
## ADR-XXX – <Titel>
- **Status:** Vorgeschlagen · **Datum:** YYYY-MM-DD · **Vorgeschlagen von:** <Agent>
- **Kontext:** <Problem, Randbedingungen>
- **Optionen:** <A, B, C mit Vor-/Nachteilen>
- **Entscheidung:** <gewählte Option>
- **Konsequenzen:** <Folgen, betroffene Module/Tasks>
```
