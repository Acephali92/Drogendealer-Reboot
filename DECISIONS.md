# DECISIONS.md – Architecture Decision Records

> Gepflegt von Agent 1 (Project Director). Neue Entscheidungen werden **angehängt**, nie gelöscht.
> Überholte ADRs erhalten Status `Ersetzt durch ADR-XXX`.

Status-Werte: `Vorgeschlagen` · `Akzeptiert` · `Abgelehnt` · `Ersetzt durch ADR-XXX`

| ID | Titel | Status | Datum |
|----|-------|--------|-------|
| ADR-001 | Dokumentgetriebene Agenten-Koordination | Akzeptiert | 2026-11-08 |
| ADR-002 | TypeScript + Vite als Tech-Stack | Ersetzt durch ADR-007, ADR-008 | 2026-11-08 |
| ADR-003 | Strikte Trennung Core/UI, deterministischer Core | Ersetzt durch ADR-006 | 2026-11-08 |
| ADR-004 | Persistenz über LocalStorage mit Schema-Version | Ersetzt durch ADR-006, ADR-010 | 2026-11-08 |
| ADR-005 | Vitest als Testframework | Akzeptiert (gilt für Backend und Frontend) | 2026-11-08 |
| ADR-006 | Echtzeit-Mehrspieler, server-autoritativ, Tick-Modell | Akzeptiert | 2026-11-08 |
| ADR-007 | Backend-Stack: Node.js, Fastify, Prisma, PostgreSQL | Akzeptiert | 2026-11-08 |
| ADR-008 | Frontend-Stack: React, Vite, TanStack Query (erledigt T-010) | Akzeptiert | 2026-11-08 |
| ADR-009 | Repo-Struktur und Ordner-Eigentum | Akzeptiert | 2026-11-08 |
| ADR-010 | Ein Datenmodell (Prisma), Journale für Nachvollziehbarkeit | Akzeptiert | 2026-11-08 |
| ADR-011 | API-Vertrag: Eigentum Backend, MSW-Mocks im Frontend | Akzeptiert | 2026-11-08 |

---

## ADR-001 – Dokumentgetriebene Agenten-Koordination
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Mehrere KI-Agenten arbeiten parallel am Projekt. Ohne gemeinsame, persistente Grundlage entstehen widersprüchliche Annahmen und Doppelarbeit.
- **Entscheidung:** Fünf Steuerungsdokumente im Repo-Root sind die einzige verbindliche Quelle: `PROJECT.md` (Was/Warum), `ARCHITECTURE.md` (Wie), `DECISIONS.md` (Warum so), `ROADMAP.md` (Wann), `TASKS.md` (Wer/Was jetzt). Agent 1 ist Eigentümer.
- **Konsequenzen:** Jede Arbeit referenziert eine Task-ID. Dokumente müssen mit dem Code synchron gehalten werden; veraltete Dokumente gelten als Bug.

## ADR-002 – TypeScript + Vite als Tech-Stack
- **Status:** Ersetzt durch ADR-007, ADR-008 · **Datum:** 2026-11-08
- **Kontext:** Zielplattform ist der Browser, kein Backend nötig. Gewünscht sind schnelle Iteration, Typsicherheit und einfache Auslieferung als statische Seite.
- **Entscheidung:** TypeScript (strict) mit Vite als Dev-Server und Bundler. Kein UI-Framework im ersten Schritt; die UI-Technik (Vanilla DOM vs. leichtgewichtiges Framework) wird in T-010 evaluiert und ggf. per eigenem ADR festgelegt.
- **Konsequenzen:** Build erzeugt statische Dateien (Hosting z. B. über GitHub Pages). Node.js LTS ist Entwicklungsvoraussetzung.

## ADR-003 – Strikte Trennung Core/UI, deterministischer Core
- **Status:** Ersetzt durch ADR-006 (der Grundsatz „reine, testbare Regelfunktionen mit seedbarem Zufall“ lebt im Backend weiter, siehe ARCHITECTURE.md §3) · **Datum:** 2026-11-08
- **Kontext:** Spiellogik muss testbar, balancierbar und unabhängig von der Darstellung weiterentwickelbar sein. Mehrere Agenten sollen parallel an Logik und UI arbeiten.
- **Entscheidung:** `src/core` ist reine, seiteneffektfreie Logik (`reduce(state, command, rng)`). Zufall nur über seeded RNG, dessen Zustand im `GameState` liegt. Keine DOM-, Zeit- oder Storage-Zugriffe im Core.
- **Konsequenzen:** Reproduzierbare Spiele und Tests; Balancing-Simulationen headless möglich. UI muss den gesamten Zustand aus `GameState` ableiten. Importregeln werden per Lint erzwungen.

## ADR-004 – Persistenz über LocalStorage mit Schema-Version
- **Status:** Ersetzt durch ADR-006, ADR-010 · **Datum:** 2026-11-08
- **Kontext:** Spielstände und Highscores sollen ohne Server erhalten bleiben.
- **Entscheidung:** Speicherung als JSON im `localStorage`. Jeder Spielstand enthält `schemaVersion`; `persistence` stellt Migrationen bereit. Fehlerhafte/unlesbare Stände werden verworfen, ohne das Spiel abstürzen zu lassen.
- **Konsequenzen:** Spielstände sind gerätegebunden. Jede Änderung an `GameState` erfordert Prüfung, ob eine Migration nötig ist (Review-Checkpunkt von Agent 1).

## ADR-005 – Vitest als Testframework
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Es braucht ein schnelles Testframework, das nahtlos mit Vite/TypeScript funktioniert.
- **Entscheidung:** Vitest für Unit- und Integrationstests, Coverage über `@vitest/coverage-v8`. E2E-Tests (z. B. Playwright) werden später bei Bedarf per eigenem ADR entschieden.
- **Konsequenzen:** Kein separates Babel/Jest-Setup. Core-Coverage-Ziel ≥ 90 %.

## ADR-006 – Echtzeit-Mehrspieler, server-autoritativ, Tick-Modell
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Angestoßen von:** Agent 4, Entscheidung des Product Owners (in den Sessions von Agent 2 und Agent 3 gewählt: „Multiplayer-Browserspiel“, „Echtzeit-Ticks“, „Echtzeit-Browsergame“)
- **Kontext:** ADR-002 bis ADR-004 gingen von einem Single-Player-Spiel mit Client-Logik und LocalStorage aus. Der Product Owner hat ein Mehrspieler-Spiel mit persistenter Welt, Kampf und Clans festgelegt.
- **Entscheidung:** Server-autoritatives Echtzeit-Browsergame. Spielzustand liegt ausschließlich in PostgreSQL, Spiellogik ausschließlich im Backend. Märkte werden in festen Ticks aktualisiert (Länge laut Parameterdatei von Agent 2), Aktionen mit Dauer speichern Endzeitpunkte und werden lazy aufgelöst.
- **Konsequenzen:** Konten, Authentifizierung, Datenschutz und Betrieb eines Servers werden nötig (PROJECT.md Q8, Q9). Der Client enthält keine Spielregeln. Regelfunktionen bleiben rein und seedbar, damit Tests und Simulation (Agent 6) sie nutzen können.

## ADR-007 – Backend-Stack: Node.js, Fastify, Prisma, PostgreSQL
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Vorgeschlagen von:** Agent 3, vom Product Owner gewählt
- **Kontext:** Ein gemeinsamer TypeScript-Stack für Frontend und Backend vereinfacht Typen, Tooling und Reviews.
- **Entscheidung:** Node.js ≥ 20, TypeScript strict (ESM), Fastify, zod, Prisma, PostgreSQL 16, argon2id, JWT (Access 15 min) + rotierende Refresh-Tokens (30 Tage, nur gehasht gespeichert). Code in `backend/`.
- **Konsequenzen:** Docker (oder lokales Postgres) für Entwicklung und Tests. Geld als `BigInt`, im JSON als String.

## ADR-008 – Frontend-Stack: React, Vite, TanStack Query
- **Status:** Akzeptiert · **Datum:** 2026-11-08 · **Vorgeschlagen von:** Agent 4 (erledigt T-010)
- **Kontext:** Die UI zeigt Server-State an, der sich pro Tick ändert, und braucht Routing, Formulare und Übersetzbarkeit.
- **Entscheidung:** React 18 + TypeScript strict + Vite in `frontend/`; Tailwind CSS; React Router; TanStack Query für Server-State (Polling); Zustand für lokalen UI-State; react-i18next (Deutsch); MSW als Mock-Server; Vitest, ESLint, Prettier; CI `.github/workflows/frontend.yml` mit lint, typecheck, test, build.
- **Konsequenzen:** Polling statt WebSockets im MVP; Push-Aktualisierung (WebSocket/SSE) kann später per eigenem ADR ergänzt werden.

## ADR-009 – Repo-Struktur und Ordner-Eigentum
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Sechs Agenten arbeiten parallel in einem Repository. Mehrere haben bereits Dateien im Root angelegt (z. B. `README.md` durch Agent 3).
- **Entscheidung:** Monorepo ohne Workspace-Tooling. Ordner und Eigentümer laut ARCHITECTURE.md §2 und PROJECT.md §5. Root-`README.md` und die Steuerungsdokumente gehören Agent 1. Die Backend-Schnellstartanleitung gehört nach `backend/README.md`. CI-Workflows je Bereich als eigene Datei unter `.github/workflows/`.
- **Konsequenzen:** Agent 3 verschiebt seinen Root-README-Inhalt nach `backend/README.md`. Beim Integrieren setzt Agent 1 die Root-`README.md` aus seiner Version zusammen und verlinkt die Bereichs-READMEs.

## ADR-010 – Ein Datenmodell (Prisma), Journale für Nachvollziehbarkeit
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Agent 3 hat bereits ein vollständiges Prisma-Schema angelegt. Agent 5 (Database Architect) soll das Datenmodell verantworten und erwägt eigene SQL-Migrationen. Zwei Schema-Quellen würden zwangsläufig auseinanderlaufen. Fachliche Anforderung: Es muss jederzeit rekonstruierbar sein, warum sich ein Marktpreis verändert hat.
- **Entscheidung:**
  1. Es gibt genau **ein** Schema: `backend/prisma/schema.prisma` mit Prisma-Migrationen. Handgeschriebenes SQL (CHECK, Trigger, Partitionierung) nur als Teil einer Prisma-Migration.
  2. **Agent 5** verantwortet das Datenmodell fachlich (Entwurf, Review jeder Schemaänderung, Dokumentation in `docs/database/`). **Agent 3** setzt es um (Migrationen, Zugriffscode). Agent 5 baut auf Agent 3s bestehendem Schema auf, statt neu zu beginnen.
  3. Wirtschaftliche Vorgänge werden in append-only Journalen gespeichert (Geld, Handel, Preisänderungen mit Ursache). Aktuelle Werte sind daraus abgeleitete Projektionen.
- **Konsequenzen:** Jede PR mit Schemaänderung braucht ein Review von Agent 5 und Agent 1. Datenbank: PostgreSQL (damit ist die DB-Frage in Agent 5s Session beantwortet).

## ADR-011 – API-Vertrag: Eigentum Backend, MSW-Mocks im Frontend
- **Status:** Akzeptiert · **Datum:** 2026-11-08
- **Kontext:** Agent 4 hat einen Vertragsentwurf `docs/frontend/API-CONTRACT.md` angelegt, Agent 3 implementiert die Endpunkte. Ohne klaren Eigentümer driften Mocks und Server auseinander.
- **Entscheidung:** Der API-Vertrag gehört **Agent 3** und liegt unter `docs/api/API-CONTRACT.md`. Agent 4s Entwurf dient als Anforderungsdokument und wird von Agent 3 übernommen bzw. abgeglichen. Mittelfristig wird eine OpenAPI-Spezifikation aus den Fastify-/zod-Schemas generiert. Das Frontend mockt ausschließlich gemäß Vertrag. Prefix `/api/v1`, Fehlerformat `{error:{code,message}}`, Geld als String.
- **Konsequenzen:** Vertragsänderungen werden von Agent 3 und Agent 4 gemeinsam abgestimmt; Breaking Changes brauchen Freigabe durch Agent 1.

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
