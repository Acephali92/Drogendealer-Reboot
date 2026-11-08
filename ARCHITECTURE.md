# ARCHITECTURE.md – Zielarchitektur

> Verantwortlich: Agent 1 (Project Director). Änderungen nur über einen ADR in [DECISIONS.md](DECISIONS.md).
> Revision 2 (2026-11-08): Umstellung auf server-autoritatives Echtzeit-Mehrspielerspiel (ADR-006 bis ADR-011).

## 1. Überblick

```
┌────────────────────────┐   HTTPS REST /api/v1 (JSON)   ┌──────────────────────────┐
│ frontend/ (Agent 4)    │ ─────────────────────────────► │ backend/ (Agent 3)       │
│ React + Vite           │ ◄───────────────────────────── │ Fastify + Prisma         │
│ TanStack Query Polling │   JWT Access + Refresh-Token   │ Spiellogik (autoritativ) │
└────────────────────────┘                                └────────────┬─────────────┘
                                                                       │ Prisma
                                ┌──────────────────────────┐           ▼
                                │ docs/game-design/        │   ┌──────────────────┐
                                │ Parameterdatei (Agent 2) │──►│ PostgreSQL       │
                                └──────────┬───────────────┘   │ Datenmodell:     │
                                           │                    │ Agent 5          │
                                           ▼                    └──────────────────┘
                                tools/simulation/ (Agent 6)
```

Grundlegende Entscheidungen: ADR-006 (Spielmodell), ADR-007 (Backend), ADR-008 (Frontend),
ADR-009 (Repo-Struktur), ADR-010 (Datenmodell & Nachvollziehbarkeit), ADR-011 (API-Vertrag).

## 2. Repository-Struktur

```
/
├── README.md, PROJECT.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, TASKS.md   # Agent 1
├── docker-compose.yml          # Agent 3 (Postgres für Dev/Test)
├── .github/workflows/          # je Bereich eine Datei: backend.yml, frontend.yml, game-design.yml
├── backend/                    # Agent 3
│   ├── prisma/schema.prisma    # einziges DB-Schema (fachlich: Agent 5)
│   ├── prisma/migrations/      # generierte + handergänzte SQL-Migrationen
│   ├── src/modules/<bereich>/  # auth, player, market, trade, travel, combat, clan …
│   └── test/
├── frontend/                   # Agent 4
├── docs/
│   ├── game-design/            # Agent 2: Regeln, Formeln, Parameterdatei, Prüfskript
│   ├── api/                    # Agent 3: API-Vertrag (Ziel: generierte OpenAPI-Spezifikation)
│   ├── database/               # Agent 5: ER-Diagramm, Nachvollziehbarkeitskonzept
│   └── frontend/               # Agent 4: UI-Richtlinien
└── tools/simulation/           # Agent 6 (Vorschlag, zu bestätigen)
```

## 3. Backend (Agent 3)

- Node.js ≥ 20, TypeScript strict, ESM. Fastify mit Plugins (JWT, CORS, Helmet, Rate-Limit), zod-Validierung.
- Modulstruktur `src/modules/<bereich>/{routes,service,schemas}.ts`. Routen enthalten keine Spiellogik; Logik liegt in Services.
- **Spielregeln als reine Funktionen** (Preisformeln, Kampfauflösung …) ohne DB-Zugriff, damit sie unit-testbar und vom Simulationswerkzeug (Agent 6) wiederverwendbar sind. Services laden Daten, rufen die Regelfunktion auf, schreiben das Ergebnis in **einer** Transaktion.
- Zufall in Regelfunktionen nur über einen übergebenen Zufallsgenerator (seedbar für Tests und Simulation).
- Spielparameter werden aus Agent 2s Parameterdatei geladen (beim Start validiert), nicht im Code dupliziert.

### Zeitmodell
- **Markt-Ticks:** ein Scheduler im Backend führt pro Tick die Marktaktualisierung aus. Ticks sind idempotent (Tick-Nummer als Schlüssel), damit ein Neustart keinen Tick doppelt ausführt.
- **Aktionen mit Dauer** (Reise, Status): Endzeitpunkt wird gespeichert (`arrivesAt`, `statusUntil`) und beim nächsten Zugriff bzw. im Tick aufgelöst.
- Serverzeit ist maßgeblich; der Client zeigt Restzeiten nur an.

## 4. Frontend (Agent 4)

- React 18 + TypeScript strict + Vite, Tailwind CSS, React Router.
- Server-State über TanStack Query (Polling passend zur Tick-Länge), lokaler UI-State über Zustand.
- react-i18next, Deutsch als Standardsprache.
- MSW-Mocks auf Basis des API-Vertrags, solange Endpunkte fehlen. Mocks müssen dem Vertrag entsprechen.
- Keine Spiellogik im Client außer Anzeige-Hilfen (z. B. Restzeit-Countdown). Alle Prüfungen erfolgen serverseitig.

## 5. Datenmodell (Agent 5, Umsetzung Agent 3)

- PostgreSQL 16, Schema ausschließlich über Prisma (`backend/prisma/schema.prisma`) und dessen Migrationen. Was Prisma nicht abbilden kann (CHECK-Constraints, Trigger, Partitionierung), wird als handgeschriebenes SQL in einer Prisma-Migration ergänzt.
- Geldbeträge: `BigInt` in der Datenbank, im JSON als **String** übertragen.
- **Nachvollziehbarkeit (Pflicht):** wirtschaftliche Vorgänge werden in unveränderlichen Journal-Tabellen (append-only) festgehalten:
  - Geldbewegungen (`MoneyTransaction`, mit `balanceAfter` und Grund)
  - Handelsvorgänge (`TradeTransaction`)
  - **Preisänderungen** mit Ursache (Tick, Handelsvolumen, Ereignis) und Bezug auf den auslösenden Datensatz, sodass jede Preisbewegung rekonstruierbar ist. Ausgearbeitet von Agent 5 in T-105.
- Aktuelle Zustände (z. B. `MarketPrice`, `Player.cash`) sind Projektionen und müssen aus den Journalen erklärbar sein.

## 6. API (Agent 3, siehe ADR-011)

- REST unter `/api/v1`, JSON, einheitliches Fehlerformat `{ "error": { "code": "...", "message": "..." } }`.
- Auth: Access-JWT (kurzlebig) + rotierender Refresh-Token.
- Vertrag: `docs/api/API-CONTRACT.md` (Ziel: aus den zod-/Fastify-Schemas generierte OpenAPI-Spezifikation). Breaking Changes nur mit neuer API-Version oder Abstimmung über Agent 1.

## 7. Qualitätskriterien

- TypeScript strict in Backend und Frontend; ESLint + Prettier.
- Vitest in Backend und Frontend. Backend-Integrationstests laufen gegen eine echte Test-Datenbank.
- Regelfunktionen: Tests für jede Formel aus Agent 2s Dokumentation, mit Referenzwerten aus dem Prüfskript.
- CI (GitHub Actions) je Bereich: lint, typecheck, test, build müssen grün sein, bevor Agent 1 freigibt.
- Sicherheit: keine Secrets im Repo (`.env.example` statt `.env`), Passwörter mit argon2id, Rate-Limits auf Auth-Endpunkten, serverseitige Validierung jeder Spieleraktion (Mengen, Geld, Status, Ort).
