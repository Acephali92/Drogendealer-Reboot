# Datenmodelle – technische Umsetzung

> Verantwortlich: Agent 3. Das **fachliche** Datenmodell verantwortet Agent 5 (ADR-010, `docs/database/`). Dieses Dokument beschreibt, wie es im Code umgesetzt ist: Tabellen, Constraints, Trigger, handgeschriebenes SQL und Migrationsregeln.
> Quelle der Wahrheit: [`prisma/schema.prisma`](../prisma/schema.prisma) und [`prisma/migrations/`](../prisma/migrations/).

## 1. Konventionen

| Thema          | Regel                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| IDs            | `cuid()`-Strings, im Prisma-Client erzeugt. Ausnahme: Zeilen aus Triggern verwenden `gen_random_uuid()::text` |
| Geld           | `BigInt` in **ganzzahligen Cent** (ADR-019), im JSON als String                                               |
| Zeit           | `TIMESTAMP(3)` in UTC, für Dauer-Aktionen Endzeitpunkte (`arrivesAt`, `statusUntil`)                          |
| Namen          | Spalten in camelCase, wie Prisma sie erzeugt; handgeschriebenes SQL quotet sie (`"cityId"`)                   |
| Löschverhalten | Jede Relation hat ein explizites `onDelete` (siehe §4)                                                        |

## 2. Tabellen nach Bereich

| Bereich           | Tabellen                                                                                      | Bemerkungen                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Konten & Auth     | `User`, `RefreshToken`                                                                        | `ageConfirmedAt` ist Pflicht (ADR-013); Refresh-Tokens werden nur gehasht gespeichert |
| Spieler           | `Player`                                                                                      | 1:1 zu `User`; `status` + `statusUntil`; `lastSeenAt` für die Online-Liste            |
| Welt & Wirtschaft | `City`, `CityConnection`, `Commodity`, `MarketPrice`, `MarketPriceChange`, `MoneyTransaction` | `MarketPriceChange` ist ein append-only Journal                                       |
| Handel            | `InventoryItem`, `TradeTransaction`                                                           | `InventoryItem` ist eine Projektion; `TradeTransaction` ist ein Journal               |
| Reisen            | `VehicleType`, `Vehicle`, `Travel`                                                            | Kapazität in Gramm (`capacityG`)                                                      |
| Kampf             | `EquipmentType`, `PlayerEquipment`, `Combat`                                                  | `Combat.log` ist JSON, das Format folgt mit den Kampfregeln                           |
| Clans & Soziales  | `Clan`, `ClanMember`, `ClanInvite`, `Message`, `Notification`, `TickerEvent`                  | 5 Clan-Rollen (`GODFATHER` … `ASSOCIATE`)                                             |

**Projektionen und Journale (ADR-010):**

- `Player.cash`/`bank`, `InventoryItem.quantity`, `MarketPrice` und `Clan.bank` sind **Projektionen**.
- Sie müssen sich aus den Journalen erklären lassen: `MoneyTransaction`, `TradeTransaction`, `MarketPriceChange`.
- Für Inventarbewegungen fehlt das Journal noch (BACKEND_ARCHITECTURE C-6).

## 3. Handgeschriebenes SQL in Migrationen

Prisma kann diese Elemente nicht ausdrücken. Sie stehen deshalb nur in den Migrationen. **`prisma migrate diff` sieht sie nicht**, das heißt: Der Drift-Check bleibt leer, obwohl sie existieren.

| Migration                      | Element                                                                                    | Zweck                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `…_init`                       | `Player_cash_nonnegative`, `Player_bank_nonnegative`, `Clan_bank_nonnegative`              | kein negatives Geld                   |
| `…_init`                       | `Player_health_range` (0 ≤ health ≤ maxHealth)                                             | gültige Lebenspunkte                  |
| `…_init`                       | `InventoryItem_quantity_nonnegative`                                                       | keine negativen Bestände              |
| `…_init`                       | `CityConnection_no_self_loop`, `Combat_no_self_attack`                                     | Plausibilität                         |
| `…_init`                       | partieller Unique-Index `ClanInvite_one_pending_per_clan_player`                           | max. 1 offene Einladung               |
| `…_case_insensitive_names`     | `User_username_lower_key`, `Player_name_lower_key` (`lower(...)`)                          | „Bob“ blockiert „bob“                 |
| `…_game_fields_and_clan_roles` | `Player_heat_range`, `Commodity_unitWeightG_positive`, `VehicleType_capacityG_nonnegative` | Wertebereiche                         |
| `…_game_fields_and_clan_roles` | Enum-Umbau `ClanRole` mit Mapping alter Werte, `RENAME COLUMN` statt Drop/Add              | keine Datenverluste                   |
| `…_market_price_journal`       | Trigger `MarketPrice_journal` → `market_price_journal()`                                   | jede Preisänderung wird journalisiert |
| `…_market_price_journal`       | Trigger `MarketPriceChange_append_only`                                                    | Journal ist unveränderlich            |

### Preisjournal (T-105)

- **Auslöser:** `AFTER INSERT OR UPDATE` auf `MarketPrice`.
  - Eine Zeile entsteht nur, wenn sich Kaufpreis, Verkaufspreis, Bestand, Stadt oder Ware ändert.
  - Ändert sich nur `updatedAt`, entsteht keine Zeile.
- **Ursache und Referenz** liest der Trigger aus transaktionslokalen Einstellungen (`app.price_change_cause`, `app.price_change_ref`). Gesetzt werden sie mit `setPriceChangeContext(tx, cause, refId)` innerhalb von `prisma.$transaction`.
- **Ohne Kontext** erhält ein INSERT die Ursache `INITIAL`, ein UPDATE `UNSPECIFIED`. Der Kontext gilt nicht über die Transaktion hinaus.
- **Schreibschutz:** `UPDATE`/`DELETE` auf dem Journal werfen `restrict_violation`. `TRUNCATE` bleibt erlaubt, für Tests und Administration.
- **Löschschutz:** Fremdschlüssel mit `Restrict`. Eine Stadt oder Ware mit Preisverlauf lässt sich nicht löschen.

## 4. Löschverhalten (Ist-Stand)

| Von → nach                                                                                                                              | onDelete    | Bewertung                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `User` → `Player`, `RefreshToken`                                                                                                       | Cascade     | ok                                                               |
| `Player` → `MoneyTransaction`, `TradeTransaction`, `Travel`, `Combat` (attacker/defender)                                               | **Cascade** | ⚠ D-1: widerspricht ADR-017, Änderung auf Restrict vorgeschlagen |
| `Player` → `InventoryItem`, `Vehicle`, `PlayerEquipment`, `ClanMember`, `ClanInvite` (Empfänger), `Message` (Empfänger), `Notification` | Cascade     | Zustand, kein Journal: vertretbar, wird mit ADR-017 überprüft    |
| `Combat.winner`, `Message.sender`, `ClanInvite.invitedBy`, `Player.currentCity`, `Travel.vehicle`                                       | SetNull     | ok                                                               |
| `City`/`Commodity` → `MarketPriceChange`, `TradeTransaction`, `Travel`                                                                  | Restrict    | Historie bleibt                                                  |

## 5. Migrationen erstellen (Arbeitsablauf)

`prisma migrate dev` verlangt bei Warnungen eine interaktive Bestätigung. `migrate reset` ist für KI-Agenten gesperrt. Deshalb gilt:

1. `schema.prisma` ändern, dann `npx prisma format && npx prisma validate`.
2. SQL erzeugen:
   ```bash
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
   ```
3. Das SQL **von Hand prüfen und korrigieren**, dann als `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` speichern.
   - Umbenennungen als `RENAME COLUMN` statt Drop/Add.
   - Enum-Änderungen mit Mapping der alten Werte.
   - Handgeschriebene Constraints und Trigger ergänzen.
4. `npx prisma migrate deploy && npx prisma generate`.
5. Drift-Check (wie in der CI): Die folgende Prüfung muss „No difference detected“ ausgeben.
   ```bash
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code
   ```
6. Review durch Agent 5 und Agent 1 vor dem Merge (ADR-010).

**Nie** eine bereits angewendete Migration nachträglich ändern. Korrekturen kommen immer als neue Migration.

## 6. Offene Schema-Vorschläge (warten auf Review durch Agent 5)

Stand und Entscheidungen werden hier nachgetragen, sobald Agent 5 geantwortet hat.

| Vorschlag                                                                                         | Zweck                                   | Bezug      |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------- |
| Pseudonymisierte Kontolöschung: `Player.userId` nullable, Status `DELETED`, Journale auf Restrict | ADR-017                                 | D-1, T-306 |
| `WorldTick` (Tick-Nummer als PK, Start/Ende, Seed)                                                | idempotente Ticks                       | C-4, T-104 |
| `CommandLog` (playerId + `idempotencyKey` unique, Typ, Request-Hash, Antwort)                     | Spielzüge nicht doppelt ausführen       | C-5        |
| `InventoryMovement` (append-only: delta, quantityAfter, Grund, refId)                             | Warenein- und -ausgänge nachvollziehbar | C-6        |
| Append-only-Trigger für `MoneyTransaction`/`TradeTransaction`                                     | unveränderliche Journale                | D-2        |
| `MoneyTransaction.account` (CASH/BANK) und Grund-Enum nach den Quellen/Senken von Agent 6         | eindeutige Salden, Geldbilanz           | B-5        |
| `Npc`/`NpcState`, `WorldState` mit Journal für die NPC-Intensität k                               | NPC-System, T-506                       | C-7        |
