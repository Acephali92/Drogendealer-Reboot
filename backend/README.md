# Drogendealer-Reboot – Backend

API-Server des Echtzeit-Browsergames: Node.js, TypeScript, Fastify, Prisma, PostgreSQL.

## Schnellstart

Voraussetzungen: Node.js ≥ 20 und Docker (oder ein lokales PostgreSQL 16). `docker compose` im Repo-Root ausführen, alle anderen Befehle in `backend/`.

```bash
docker compose up -d db
```

```bash
cp .env.example .env && npm install
```

```bash
npm run db:deploy
```

```bash
npm run dev
```

Der Server läuft dann unter `http://localhost:3000/api/v1`.

### Scripts

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

Die vollständige Referenz mit allen Antwortformaten steht in [`docs/api/API-CONTRACT.md`](../docs/api/API-CONTRACT.md).

- **Öffentlich:** `GET /api/v1/health` und `POST /api/v1/auth/register | login | refresh | logout`.
- **Mit Bearer-Token:**
  - Spieler: `/players/me`, `/players/me/transactions`, `/players/online`
  - Welt und Markt: `/cities`, `/cities/:slug`, `/cities/:slug/market`, `/market/overview`
  - Besitz: `/inventory`, `/vehicle-types`, `/vehicles`, `/equipment-types`, `/equipment`, `/travel/current`
  - Clans und Soziales: `/clans`, `/clans/:id`, `/clan-invites`, `/rankings`, `/notifications` (inkl. Gelesen-Markierung), `/ticker`

Bisher gibt es fast nur Lese-Endpunkte. Aktionen wie Handeln, Reisen, Kaufen oder Clan-Verwaltung folgen, sobald die Spielregeln feststehen.
Fehler kommen immer als `{ "error": { "code": "...", "message": "..." } }`. Geldbeträge sind Strings in **ganzen** Spielwährungs-Einheiten, nicht in Cent.

### Authentifizierung

- Passwörter: argon2id.
- **Access-Token:** JWT, Standard-Laufzeit 15 Minuten (`ACCESS_TOKEN_TTL`). Wird als `Authorization: Bearer <token>` gesendet. Claims: `sub` = User-ID, `pid` = Spieler-ID, `role`.
- **Refresh-Token:** zufälliges, opakes Token mit Standard-Laufzeit 30 Tage. In der DB liegt nur der SHA-256-Hash. Jeder Refresh rotiert das Token. Wird ein bereits verbrauchtes Token erneut benutzt, werden alle Sitzungen des Kontos widerrufen (Schutz bei Token-Diebstahl).
- **Rate-Limit** auf allen `/auth/*`-Routen, pro IP und Minute (`AUTH_RATE_LIMIT_MAX`). Hinter einem Reverse-Proxy muss `TRUST_PROXY=true` gesetzt sein.
- E-Mails werden kleingeschrieben gespeichert. Usernamen und Spielernamen sind ohne Beachtung der Groß-/Kleinschreibung eindeutig.

## Datenmodell

Das Prisma-Schema (`prisma/schema.prisma`) deckt bereits alle Spielbereiche ab:

- **Konten & Auth:** `User`, `RefreshToken`
- **Spieler & Fortschritt:** `Player` (Geld, Gesundheit, Level, XP, Ruf, Heat, Standort, Status mit `statusUntil`, `lastSeenAt`)
- **Welt & Wirtschaft:** `City`, `CityConnection`, `Commodity`, `MarketPrice`, `MarketPriceChange` (append-only Preisjournal), `MoneyTransaction` (Kontobuch)
- **Handel:** `InventoryItem`, `TradeTransaction`
- **Reisen & Fahrzeuge:** `VehicleType`, `Vehicle`, `Travel` (mit `arrivesAt` für Echtzeit-Reisen)
- **Kampf:** `EquipmentType`, `PlayerEquipment`, `Combat`
- **Clans & Soziales:** `Clan`, `ClanMember` (max. 1 Clan pro Spieler; Rollen Pate/Consigliere/Capo/Soldat/Mitläufer), `ClanInvite`, `Message`, `Notification`, `TickerEvent`

Zusätzlich in den Migrationen von Hand ergänzt, weil Prisma das nicht abbilden kann:

- CHECK-Constraints: kein negatives Geld oder Inventar, Gesundheit ≤ max., keine Selbstangriffe
- höchstens eine offene Clan-Einladung pro Spieler und Clan
- case-insensitive Unique-Indizes auf Namen
- Preisjournal-Trigger: Jede Änderung an `MarketPrice` erzeugt automatisch einen Eintrag in `MarketPriceChange` mit altem und neuem Wert, Ursache und Referenz. Das Journal lässt sich weder ändern noch löschen.
  Die Ursache setzt der Code innerhalb der Transaktion mit `setPriceChangeContext(tx, 'TRADE', tradeId)` aus `src/modules/world/price-journal.ts`.

**Spiellogik** (Preise, Reisezeiten, Kampfformeln, Clan-Regeln) ist bewusst noch nicht implementiert. Sie folgt, sobald der Game Designer die Regeln festgelegt hat.
Die Startwerte neuer Spieler sind Platzhalter in `src/modules/player/player.service.ts` (`PLAYER_START_VALUES`).
