# Drogendealer-Reboot

Echtzeit-Browsergame (persistente Welt): Handel, Reisen, Kampf und Clans.

## Projektstruktur

| Ordner | Inhalt |
|---|---|
| `backend/` | API-Server: Node.js, TypeScript, Fastify, Prisma, PostgreSQL |

## Backend: Schnellstart

Voraussetzungen: Node.js ≥ 20 und Docker (oder ein lokales PostgreSQL 16).

```bash
docker compose up -d db
```

```bash
cd backend && cp .env.example .env && npm install
```

```bash
npm run db:deploy
```

```bash
npm run dev
```

Der Server läuft dann unter `http://localhost:3000/api/v1`.

### Scripts (`backend/`)

| Script | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload (tsx) |
| `npm run build` / `npm start` | Kompilieren nach `dist/` bzw. starten |
| `npm run typecheck` | TypeScript-Prüfung (inkl. Tests) |
| `npm test` | Unit- und Integrationstests (nutzt `TEST_DATABASE_URL`) |
| `npm run db:migrate` | Neue Migration aus `schema.prisma` erzeugen und anwenden (Entwicklung) |
| `npm run db:deploy` | Vorhandene Migrationen anwenden (CI/Produktion) |

Die Tests brauchen eine **eigene** Datenbank (`TEST_DATABASE_URL`, Standard `drogendealer_test`). Deren Tabellen werden vor jedem Test geleert. Der Docker-Container legt sie beim ersten Start automatisch an.

## API (v1)

Alle Fehler haben das Format `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`.
Geldbeträge (`BigInt` in der DB) werden als Strings ausgeliefert, zum Beispiel `"cash": "1500"`.

| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/v1/health` | – | Liveness + Datenbank-Check |
| POST | `/api/v1/auth/register` | – | `{ email, username, password }` → `201 { accessToken, refreshToken, user }`; legt Konto **und** Spieler an |
| POST | `/api/v1/auth/login` | – | `{ login, password }` (`login` = E-Mail oder Username) → `{ accessToken, refreshToken, user }` |
| POST | `/api/v1/auth/refresh` | – | `{ refreshToken }` → neues Token-Paar (Rotation) |
| POST | `/api/v1/auth/logout` | – | `{ refreshToken }` → `204` |
| GET | `/api/v1/players/me` | Bearer | Eigenes Spielerprofil |

### Authentifizierung

- Passwörter: argon2id.
- **Access-Token:** JWT, Standard-Laufzeit 15 Minuten (`ACCESS_TOKEN_TTL`). Wird als `Authorization: Bearer <token>` gesendet. Claims: `sub` = User-ID, `pid` = Spieler-ID, `role`.
- **Refresh-Token:** zufälliges, opakes Token mit Standard-Laufzeit 30 Tage. In der DB liegt nur der SHA-256-Hash. Jeder Refresh rotiert das Token. Wird ein bereits verbrauchtes Token erneut benutzt, werden alle Sitzungen des Kontos widerrufen (Schutz bei Token-Diebstahl).
- **Rate-Limit** auf allen `/auth/*`-Routen, pro IP und Minute (`AUTH_RATE_LIMIT_MAX`). Hinter einem Reverse-Proxy muss `TRUST_PROXY=true` gesetzt sein.
- E-Mails werden kleingeschrieben gespeichert. Usernamen und Spielernamen sind ohne Beachtung der Groß-/Kleinschreibung eindeutig.

## Datenmodell

Das Prisma-Schema (`backend/prisma/schema.prisma`) deckt bereits alle Spielbereiche ab:

- **Konten & Auth:** `User`, `RefreshToken`
- **Spieler & Fortschritt:** `Player` (Geld, Gesundheit, Level, XP, Ruf, Standort, Status mit `statusUntil`)
- **Welt & Wirtschaft:** `City`, `CityConnection`, `Commodity`, `MarketPrice`, `MoneyTransaction` (Kontobuch)
- **Handel:** `InventoryItem`, `TradeTransaction`
- **Reisen & Fahrzeuge:** `VehicleType`, `Vehicle`, `Travel` (mit `arrivesAt` für Echtzeit-Reisen)
- **Kampf:** `EquipmentType`, `PlayerEquipment`, `Combat`
- **Clans & Soziales:** `Clan`, `ClanMember` (max. 1 Clan pro Spieler), `ClanInvite`, `Message`

Zusätzlich in den Migrationen von Hand ergänzt, weil Prisma das nicht abbilden kann:

- CHECK-Constraints: kein negatives Geld oder Inventar, Gesundheit ≤ max., keine Selbstangriffe
- höchstens eine offene Clan-Einladung pro Spieler und Clan
- case-insensitive Unique-Indizes auf Namen

**Spiellogik** (Preise, Reisezeiten, Kampfformeln, Clan-Regeln) ist bewusst noch nicht implementiert. Sie folgt, sobald der Game Designer die Regeln festgelegt hat.
Die Startwerte neuer Spieler sind Platzhalter in `backend/src/modules/player/player.service.ts` (`PLAYER_START_VALUES`).
