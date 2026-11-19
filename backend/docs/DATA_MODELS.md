# Datenmodelle – technische Umsetzung

> Verantwortlich: Agent 3 (ADR-022, auch für das Fachmodell). Fachmodell, Invarianten und Löschregeln: [`docs/database/DATA_MODEL.md`](../../docs/database/DATA_MODEL.md). Dieses Dokument beschreibt, wie es im Code umgesetzt ist: Tabellen, Constraints, Trigger, handgeschriebenes SQL und Migrationsregeln.
> Quelle der Wahrheit: [`prisma/schema.prisma`](../prisma/schema.prisma) und [`prisma/migrations/`](../prisma/migrations/).

## 1. Konventionen

| Thema          | Regel                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| IDs            | `cuid()`-Strings, im Prisma-Client erzeugt. Ausnahme: Zeilen aus Triggern verwenden `gen_random_uuid()::text` |
| Geld           | `BigInt` in **ganzzahligen Cent** (ADR-019), im JSON als String                                               |
| Zeit           | `TIMESTAMP(3)` in UTC, für Dauer-Aktionen Endzeitpunkte (`arrivesAt`, `statusUntil`)                          |
| Namen          | Spalten in camelCase, wie Prisma sie erzeugt; handgeschriebenes SQL quotet sie (`"cityId"`)                   |
| Löschverhalten | Jede Relation hat ein explizites `onDelete` (siehe §4)                                                        |

## 2. Tabellen nach Bereich (Datenmodell v2)

| Bereich          | Tabellen                                                                                                                          | Bemerkungen                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Konten & Auth    | `User`, `RefreshToken`                                                                                                            | `ageConfirmedAt` ist Pflicht (ADR-013); Refresh-Tokens nur gehasht                                                                         |
| Spieler          | `Player`, `PlayerCityHeat`                                                                                                        | `cash` = Bargeld, `bank` = Bankkonto (ADR-023); `userId` nullable und Status `DELETED` (ADR-017); Heat je Stadt (Float)                    |
| Katalog          | `City`, `Commodity`, `VehicleType`, `EquipmentType`                                                                               | **nur `id` + `slug`** (+ `slot`); Werte aus `parameters.toml`, synchronisiert beim Start (`syncCatalog`, `src/modules/catalog/catalog.ts`) |
| Markt            | `MarketState`                                                                                                                     | `stock`/`noise` als Float, `activeEvent`, `eventTicksLeft`; Preise werden berechnet, nicht gespeichert                                     |
| Besitz           | `InventoryLot`, `Vehicle`, `PlayerEquipment`                                                                                      | Lose je Kaufzeitpunkt mit `costBasis`                                                                                                      |
| Journale         | `MoneyTransaction` (`account` CASH/BANK), `InventoryMovement`, `TradeTransaction`, `MarketStateChange`, `ClanTreasuryTransaction` | append-only, Restrict-FKs                                                                                                                  |
| Historie         | `Travel`, `Combat`                                                                                                                | Restrict zum Spieler                                                                                                                       |
| Clans & Soziales | `Clan` (`treasuryCash`/`treasuryBank`, `dissolvedAt`), `ClanMember`, `ClanInvite`, `Message`, `Notification`, `TickerEvent`       | 5 Clan-Rollen (ADR-021)                                                                                                                    |

Schreibwege mit Invarianten: Geld nur über `bookMoney()` (`src/modules/money/ledger.ts`), Marktzustand nur in Transaktionen mit `setMarketChangeContext()` (`src/modules/world/market-journal.ts`).

## 3. Handgeschriebenes SQL in Migrationen

Prisma kann diese Elemente nicht ausdrücken. Sie stehen deshalb nur in den Migrationen. **`prisma migrate diff` sieht sie nicht**, das heißt: Der Drift-Check bleibt leer, obwohl sie existieren.

| Migration                  | Element                                                                                                                                                                                                                                                                                                                                                                                                  | Zweck                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `…_init`                   | `Player_cash_nonnegative`, `Player_bank_nonnegative`, `Player_health_range`                                                                                                                                                                                                                                                                                                                              | gültige Spielerwerte                                                 |
| `…_init`                   | `Combat_no_self_attack`, partieller Unique-Index `ClanInvite_one_pending_per_clan_player`                                                                                                                                                                                                                                                                                                                | Plausibilität                                                        |
| `…_case_insensitive_names` | `User_username_lower_key`, `Player_name_lower_key`                                                                                                                                                                                                                                                                                                                                                       | „Bob“ blockiert „bob“                                                |
| `…_data_model_v2`          | `Clan_treasuryCash_nonnegative` (umbenannt), `Clan_treasuryBank_nonnegative`, `MarketState_stock_nonnegative`, `MarketState_eventTicksLeft_nonnegative`, `PlayerCityHeat_heat_nonnegative`, `InventoryLot_quantity/costBasis_nonnegative`, `InventoryMovement_delta_nonzero`, `InventoryMovement_quantityAfter_nonnegative`, `MoneyTransaction_amount_nonzero`, `ClanTreasuryTransaction_amount_nonzero` | Wertebereiche                                                        |
| `…_data_model_v2`          | Trigger `MarketState_journal` → `market_state_journal()`                                                                                                                                                                                                                                                                                                                                                 | jede Änderung von Bestand, Rauschen oder Ereignis wird journalisiert |
| `…_data_model_v2`          | Funktion `journal_append_only()` + Trigger auf `MarketStateChange`, `MoneyTransaction`, `TradeTransaction`, `InventoryMovement`, `ClanTreasuryTransaction`                                                                                                                                                                                                                                               | Journale sind unveränderlich                                         |
| `…_data_model_v2`          | `DROP FUNCTION market_price_journal / market_price_change_append_only`                                                                                                                                                                                                                                                                                                                                   | Aufräumen des alten Preisjournals (T-105 v1)                         |

### Marktzustands-Journal (T-105 v2)

- **Auslöser:** `AFTER INSERT OR UPDATE` auf `MarketState`. Eine Zeile entsteht, wenn sich `stock`, `noise`, `activeEvent`, Stadt oder Ware ändert. Ein reiner Countdown von `eventTicksLeft` erzeugt keine Zeile.
- **Kontext:** `setMarketChangeContext(tx, cause, refId?, tick?)` setzt `app.market_change_cause`, `…_ref` und `…_tick` transaktionslokal. Ohne Kontext gilt `INITIAL` beim INSERT und `UNSPECIFIED` beim UPDATE.
- **Ursachen:** `INITIAL | TRADE | TICK | EVENT | NPC | ADMIN | UNSPECIFIED`. `NPC` und der Tick-Bezug sind Anforderungen aus GAME_ECONOMY.md §7 T-6.
- **Schreibschutz:** `UPDATE`/`DELETE` werfen `restrict_violation`. `TRUNCATE` bleibt erlaubt (Tests).

## 4. Löschverhalten

| Von → nach                                                                                                                                               | onDelete     | Grund                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `User` → `RefreshToken`                                                                                                                                  | Cascade      | Sitzungen sind personenbezogen                                                                      |
| `User` → `Player`                                                                                                                                        | **SetNull**  | Spieler bleibt pseudonymisiert erhalten (ADR-017)                                                   |
| `Player` → `MoneyTransaction`, `TradeTransaction`, `InventoryMovement`, `Travel`, `Combat` (attacker/defender), `ClanTreasuryTransaction`                | **Restrict** | Journale und Historie bleiben vollständig                                                           |
| `Player` → `InventoryLot`, `Vehicle`, `PlayerEquipment`, `PlayerCityHeat`, `ClanMember`, `ClanInvite` (Empfänger), `Message` (Empfänger), `Notification` | Cascade      | Zustand ohne Journalpflicht; die Kontolöschung entfernt ihn ohnehin explizit (`account.service.ts`) |
| `Combat.winner`, `Message.sender`, `ClanInvite.invitedBy`, `Player.currentCity`, `Travel.vehicle`                                                        | SetNull      | –                                                                                                   |
| Katalog → Markt, Journale, Historie                                                                                                                      | Restrict     | Historie bleibt                                                                                     |
| `Clan` → `ClanTreasuryTransaction`                                                                                                                       | Restrict     | Clans werden aufgelöst (`dissolvedAt`), nicht gelöscht                                              |

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

## 6. Schema-Vorschläge: Stand

Seit ADR-022 entscheidet Agent 3 selbst über das Datenmodell (Review durch Agent 1).

| Vorschlag                                                                    | Stand                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Pseudonymisierte Kontolöschung, Journale auf Restrict (ADR-017, D-1)         | ✅ v2                                                                                      |
| Append-only für alle Journale (D-2)                                          | ✅ v2                                                                                      |
| `InventoryMovement` + Lose (C-6)                                             | ✅ v2                                                                                      |
| `MoneyTransaction.account`, Gründe nach Quellen/Senken (B-5)                 | ✅ v2                                                                                      |
| Schwarz-/Weißgeld (B-9)                                                      | ✅ entschieden per ADR-023: `cash`/`bank`; Wäsche- und Beschlagnahme-Logik mit T-120/T-121 |
| Heat pro Stadt, Volumen, Float-Bestand, Katalog aus Parametern (B-11 … B-14) | ✅ v2                                                                                      |
| Clan-Kasse mit Journal (ADR-018)                                             | ✅ Schema v2; Endpunkte mit T-309                                                          |
| `WorldTick` (idempotente Ticks, T-104)                                       | offen                                                                                      |
| `CommandLog` (Idempotenz-Schlüssel, C-5)                                     | offen, vor den ersten Schreib-Endpunkten (T-106)                                           |
| `Npc`/`WorldState` mit Journal für die NPC-Intensität k (T-506)              | offen                                                                                      |
| Partitionierung/Archivierung der Journale (T-507)                            | Konzept in `docs/database/DATA_MODEL.md` §6                                                |
