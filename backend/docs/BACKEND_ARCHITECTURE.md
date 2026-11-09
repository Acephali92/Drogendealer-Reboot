# Backend-Architektur

> Verantwortlich: Agent 3 (Backend). Ergänzt [`ARCHITECTURE.md`](../../ARCHITECTURE.md) von Agent 1, das die Zielarchitektur festlegt. Dieses Dokument beschreibt, wie das Backend **tatsächlich** aufgebaut ist, und enthält die Bestandsaufnahme.
> Stand: 2026-11-09, Branch `claude/nice-wright-ljm3zq`.

Weitere Backend-Dokumente: [DATA_MODELS](DATA_MODELS.md) · [API_DOCUMENTATION](API_DOCUMENTATION.md) · [SYSTEM_DEPENDENCIES](SYSTEM_DEPENDENCIES.md) · [BACKEND_TESTING](BACKEND_TESTING.md) · [TECHNICAL_DECISIONS](TECHNICAL_DECISIONS.md)

## 1. Schichten

```
HTTP ──► routes (Fastify)  ──► service (Prisma, Transaktionen) ──► domain (reine Regeln)
           zod-Validierung        lädt Zustand, ruft Regeln auf,      keine I/O, seedbarer
           Auth, Rate-Limit       schreibt Ergebnis + Journale         Zufall, Zeit als Parameter
                                  in EINER Transaktion
```

| Schicht     | Ordner                                       | Darf                                                                             | Darf nicht                                                            |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Routes      | `src/modules/<bereich>/<bereich>.routes.ts`  | Eingaben mit zod prüfen, Service aufrufen, Statuscode setzen                     | Spiellogik, direkte Regelberechnung                                   |
| Service     | `src/modules/<bereich>/<bereich>.service.ts` | Prisma, Transaktionen, Journale schreiben, Domain-Funktionen aufrufen            | Spielregeln selbst implementieren (sobald es sie gibt)                |
| Domain      | `src/domain/`                                | reine Funktionen, `Rng`, BigInt-Arithmetik, Tick-Rechnung                        | DB, HTTP, `node:*`, `Date.now`/`new Date()`, `Math.random`, `process` |
| Querschnitt | `src/lib/`, `src/plugins/`, `src/config/`    | Passwort-Hashing, Tokens, Serialisierung, Fehlerformat, Auth, Prisma-Client, ENV | –                                                                     |

Die Domain-Regeln werden **per ESLint erzwungen** (`eslint.config.js`, Block für `src/domain/**/*.ts`). Hintergrund: Die Balancing-Simulation (`sim/`, Agent 6) importiert `src/domain/` direkt (ADR-012).

## 2. Verzeichnisstruktur

```
backend/
  prisma/schema.prisma              einziges DB-Schema (ADR-010)
  prisma/migrations/                Prisma-Migrationen + handgeschriebenes SQL (CHECK, Trigger, Indizes)
  src/
    server.ts                       Einstieg: ENV laden, App bauen, listen, Graceful Shutdown
    app.ts                          buildApp(env): Plugins + Routen (öffentlich / authentifiziert)
    config/env.ts                   zod-validierte Umgebungsvariablen (einzige Konfigurationsquelle)
    plugins/{prisma,auth,errors}.ts Prisma-Client, JWT + `authenticate`, einheitliches Fehlerformat
    lib/                            password (argon2id), tokens, serialize (BigInt→String), errors, pagination
    domain/                         rng, money, time, types (I/O-frei)
    modules/
      health  auth  account  player  world  inventory  vehicles  equipment
      travel  clans  rankings  notifications  ticker
  test/                             Integrationstests (Test-DB) + test/domain (ohne DB)
  docs/                             diese Dokumente
```

## 3. Ablauf einer Anfrage

1. **Fastify-Plugins** (`src/app.ts`): Fehler-Handler → Helmet → CORS → Rate-Limit (nur per Route aktiviert) → Prisma → JWT.
2. **Öffentlich:** `/api/v1/health`, `/api/v1/auth/*`.
3. **Authentifiziert:** ein gemeinsamer Scope mit `onRequest: app.authenticate`.
   - `authenticate` prüft das JWT.
   - Danach aktualisiert es `Player.lastSeenAt`, höchstens einmal pro Minute, und zwar per bedingtem `updateMany` (`src/plugins/auth.ts`).
4. **Route:** `schema.parse(request.body|query|params)`. Ein `ZodError` wird zu `400 VALIDATION_ERROR` (`src/plugins/errors.ts`).
5. **Service:** liest und schreibt über Prisma. Fachliche Fehler wirft der Service als `AppError(status, code, message)` (`src/lib/errors.ts`). Die Domain wirft später `DomainError(code)`, das der Service übersetzt.
6. **Antwort:** BigInt-Werte gehen über `serialize()` (`src/lib/serialize.ts`) als String ins JSON.

## 4. Querschnittsthemen

| Thema         | Umsetzung                                                                                                                                        | Datei                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Konfiguration | nur ENV, beim Start mit zod validiert; ungültige Werte brechen den Start ab                                                                      | `src/config/env.ts`, `.env.example`   |
| Auth          | argon2id; Access-JWT (`sub`, `pid`, `role`); Refresh-Token opak, nur SHA-256 gespeichert, Rotation, Wiederverwendung → alle Sitzungen widerrufen | `src/modules/auth/auth.service.ts`    |
| Rate-Limits   | `/auth/*` (ENV `AUTH_RATE_LIMIT_MAX`/Min), Export und Löschung des Kontos 5/Min                                                                  | `auth.routes.ts`, `account.routes.ts` |
| Fehlerformat  | `{ error: { code, message, details? } }`, 404-Handler, Prisma P2002 → 409                                                                        | `src/plugins/errors.ts`               |
| Geld          | ganzzahlige Cent (ADR-019), `BigInt` in DB und Domain, String im JSON; Rundung über `domain/money.ts`                                            | –                                     |
| Datenschutz   | Datenexport, Konto löschen (ADR-015). Achtung: Die Löschung läuft noch per Cascade, siehe D-1                                                    | `src/modules/account/`                |

## 5. Zeit- und Tick-Modell

**Stand:** Nur die reinen Bausteine existieren (`src/domain/time.ts`). Es gibt noch keinen Scheduler und keine Tick-Tabelle.

- **Spielzeit** wird in Ticks gezählt. Eine Umrechnung aus Serverzeit erfolgt nur über eine `TickClock` (`epochMs`, `tickLengthMs`). Die Tick-Länge ist ein Parameter von Agent 2 und kein Code-Wert.
- **Domain-Code** bekommt die Zeit immer übergeben. So vermischen sich Spielzeit und Serverzeit nicht unkontrolliert.
- **Geplant (T-104),** abhängig vom Schema-Review durch Agent 5:
  - Ein Scheduler im Backend bestimmt mit `dueTicks(clock, lastProcessedTick, now)` die fälligen Ticks.
  - Jeder Tick läuft in einer Transaktion, mit der Tick-Nummer als Primärschlüssel in einer `WorldTick`-Tabelle. Bei einem Neustart wird damit kein Tick doppelt und keiner ausgelassen.
- **Aktionen mit Dauer** (Reise, Status) speichern einen Endzeitpunkt. Aufgelöst werden sie beim nächsten Zugriff oder im Tick (ADR-006). Diese Auflösung fehlt noch, siehe B-2.

---

## 6. Bestandsaufnahme (2026-11-09)

Es zählt nur, was im Code existiert. Belege sind als Datei:Zeile angegeben. Testzahlen stehen in [BACKEND_TESTING](BACKEND_TESTING.md).

### A – Vorhanden und funktionsfähig

| #   | System                                                                                                                                                 | Beleg                                                                                 | Tests                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------- |
| A-1 | App-Gerüst, Plugins, Graceful Shutdown                                                                                                                 | `src/app.ts`, `src/server.ts`                                                         | `auth.test.ts` (Health, 404)          |
| A-2 | Konfiguration ausschließlich über ENV                                                                                                                  | `src/config/env.ts`                                                                   | Start bricht bei ungültiger ENV ab    |
| A-3 | Registrierung (inkl. Altersbestätigung ADR-013), Login, Refresh-Rotation, Logout                                                                       | `src/modules/auth/*`                                                                  | 22 in `auth.test.ts`                  |
| A-4 | Lese-Endpunkte Spieler, Welt/Markt, Inventar, Fahrzeuge, Ausrüstung, Reise, Clans, Ranglisten, Benachrichtigungen, Ticker                              | `src/modules/*`                                                                       | `world.test.ts`, `social.test.ts`     |
| A-5 | Preisjournal per Trigger, append-only, Ursache per Transaktionskontext                                                                                 | Migration `20261108180000_market_price_journal`, `src/modules/world/price-journal.ts` | 6 in `price-journal.test.ts`          |
| A-6 | Integritäts-Constraints: kein negatives Geld/Inventar, Heat 0–100, keine Selbstangriffe, max. 1 offene Clan-Einladung, Namen case-insensitiv eindeutig | Migrationen `…_init`, `…_case_insensitive_names`, `…_game_fields_and_clan_roles`      | indirekt                              |
| A-7 | Datenexport (ADR-015)                                                                                                                                  | `src/modules/account/account.service.ts`                                              | `account.test.ts`                     |
| A-8 | Domain-Bausteine: seedbarer RNG, Geldrundung, Tick-Uhr                                                                                                 | `src/domain/*`                                                                        | 32 in `test/domain/`                  |
| A-9 | Lint/Format/CI                                                                                                                                         | `eslint.config.js`, `.github/workflows/backend.yml`                                   | CI-Lauf steht noch aus (Workflow neu) |

### B – Vorhanden, aber unvollständig

| #   | Befund                                                                                                                                                                        | Beleg                                                                                                        | Nächster Schritt                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| B-1 | Spielerstatus ohne Zustandsautomat; `statusUntil` wird nie ausgewertet                                                                                                        | `schema.prisma` (`PlayerStatus`), kein Code liest `statusUntil`                                              | T-203                                   |
| B-2 | Reisen werden nicht aufgelöst; eine abgelaufene Reise bleibt `IN_PROGRESS`                                                                                                    | `src/modules/travel/travel.service.ts:7`                                                                     | T-202                                   |
| B-3 | Lagerkapazität nur aus dem aktiven Fahrzeug, Ausrüstungsgewicht zählt nicht, keine Basiskapazität                                                                             | `src/modules/inventory/inventory.service.ts:7`                                                               | Regeln Agent 2                          |
| B-4 | `InventoryItem.avgBuyPrice` existiert, wird aber von keinem Code gepflegt                                                                                                     | `schema.prisma`, `inventory.service.ts:14`                                                                   | T-106                                   |
| B-5 | `MoneyTransaction` wird nirgends geschrieben. `balanceAfter` ist mehrdeutig (Bargeld oder Bank?), und die Gründe decken die Quellen/Senken aus dem Balancing-Konzept nicht ab | `schema.prisma:225-250`                                                                                      | Vorschlag an Agent 5                    |
| B-6 | `Commodity.basePrice/minPrice/maxPrice` in der DB, obwohl Spielwerte aus `parameters.toml` kommen sollen; es droht doppelte Pflege                                            | `schema.prisma` (`Commodity`)                                                                                | T-101/T-102: DB nur als Seed-Projektion |
| B-7 | Startwerte und XP-Kurve sind Platzhalter im Code                                                                                                                              | `src/modules/player/player.service.ts:11, 29`                                                                | T-101                                   |
| B-8 | Kontolöschung funktioniert, entspricht aber nicht ADR-017 (siehe D-1)                                                                                                         | `src/modules/account/account.service.ts`                                                                     | Review Agent 5                          |
| B-9 | Das Datenmodell kennt nur `cash`/`bank`. Game Design unterscheidet Schwarz- und Weißgeld (`start_cash_black`, `start_cash_white`, Geldwäsche)                                 | `schema.prisma` (`Player`), `docs/game-design/parameters.toml:20-21`, `docs/game-design/money-laundering.md` | Schema-Vorschlag an Agent 5, mit T-101  |

### C – Noch nicht implementiert

| #    | System                                                                                                                   | Abhängig von                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| C-1  | Schreibende Spielaktionen: Kaufen/Verkaufen, Reise starten, Fahrzeug/Ausrüstung kaufen, Startstadt, Kampf, Clan-Aktionen | Regeln A2, Schema A5                  |
| C-2  | Laden und Validieren der Parameter aus `docs/game-design/parameters.toml` (T-101)                                        | Datei von A2 (noch auf keinem Branch) |
| C-3  | Preisformeln und weitere Spielregeln als Domain-Funktionen (T-103)                                                       | Formeln + Golden Vectors von A2       |
| C-4  | Tick-Scheduler, `WorldTick`, Markt-Tick (T-104)                                                                          | C-2, C-3, Schema A5                   |
| C-5  | Idempotenz-Schlüssel für Spielzüge (Schutz vor doppelter Ausführung)                                                     | Schema A5                             |
| C-6  | Inventarjournal (Ein- und Ausgänge nachvollziehbar)                                                                      | Schema A5                             |
| C-7  | NPC- und Händlersystem, NPC-Intensität k (T-506)                                                                         | Regeln A2/A6, Schema A5               |
| C-8  | Immobilien (T-501), Fähigkeiten/Attribute, Aufträge, laufende Ausgaben, Wirtschaftsereignisse (T-502)                    | Regeln A2                             |
| C-9  | Seed-Daten für Städte, Verbindungen, Waren (T-102)                                                                       | C-2                                   |
| C-10 | Deployment (T-602)                                                                                                       | M6                                    |

### D – Vorhanden, aber technisch problematisch

| #   | Problem                                                                                                               | Beleg                                   | Risiko                                                              | Maßnahme                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| D-1 | `onDelete: Cascade` von Player auf Journale und Historie (`MoneyTransaction`, `TradeTransaction`, `Travel`, `Combat`) | `schema.prisma:246, 284, 340, 405, 406` | Kontolöschung entfernt Journalzeilen; verstößt gegen ADR-010/017    | Restrict + Pseudonymisierung, Vorschlag bei Agent 5                                                                    |
| D-2 | `MoneyTransaction` und `TradeTransaction` sind nicht technisch append-only (anders als `MarketPriceChange`)           | Migrationen                             | Journale könnten per Code geändert oder gelöscht werden             | Trigger wie bei T-105, Vorschlag an Agent 5                                                                            |
| D-3 | IP und User-Agent unbefristet an `RefreshToken` gespeichert                                                           | `schema.prisma:52-53`                   | ADR-015 (Datensparsamkeit)                                          | T-605 (Release-Blocker)                                                                                                |
| D-4 | Gegner verlieren ihre Kampfhistorie, wenn ein Spieler sein Konto löscht                                               | `schema.prisma:405-406`                 | Datenverlust für Dritte                                             | wird mit D-1 gelöst                                                                                                    |
| D-5 | Abgeleitete Projektionen (z. B. `Player.cash`) sind nicht gegen die Journale abgesichert                              | –                                       | Projektion und Journal können auseinanderlaufen, sobald Geld fließt | jede Geldbewegung nur über einen Service-Helfer, der Projektion + Journal gemeinsam schreibt; Konsistenztest (Agent 1) |

Behoben in dieser Runde: Testdaten nutzen jetzt fiktive Namen (ADR-013); fehlendes Lint/Format/CI (früher B) ist ergänzt.

Abhängigkeiten zwischen den Systemen: siehe [SYSTEM_DEPENDENCIES](SYSTEM_DEPENDENCIES.md).
