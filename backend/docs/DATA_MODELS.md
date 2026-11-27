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
| Journale         | `MoneyTransaction` (`account` CASH/BANK), `InventoryMovement`, `TradeTransaction`, `MarketStateChange`, `ClanTreasuryTransaction` | append-only, Restrict-FKs; Journalkopf `seq`, `tick`, `correlationId`, Akteur (TD-022, §3.2)                                               |
| Historie         | `Travel`, `Combat`                                                                                                                | Restrict zum Spieler                                                                                                                       |
| Clans & Soziales | `Clan` (`treasuryCash`/`treasuryBank`, `dissolvedAt`), `ClanMember`, `ClanInvite`, `Message`, `Notification`, `TickerEvent`       | 5 Clan-Rollen (ADR-021)                                                                                                                    |

Schreibwege mit Invarianten:

- Jede schreibende Transaktion setzt zuerst `setJournalContext()` (`src/modules/journal/context.ts`).
- Geld nur über `bookMoney()` (`src/modules/money/ledger.ts`).
- Marktzustand nur nach `setMarketChangeContext()` (`src/modules/world/market-journal.ts`).

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
| `…_journal_context`        | Funktionen `set_journal_context()`, `journal_context()`; Defaults von `tick`, `correlationId`, `actorType`; Trigger `*_actor_player` → `journal_actor_player()`; CHECKs `*_tick_check`, `*_actor_check`                                                                                                                                                                                                  | Journalkopf fail-closed (TD-022, §3.2)                               |
| `…_journal_context`        | Trigger `MarketState_version` → `market_state_version()`; `market_state_journal()` fail-closed ersetzt; CHECKs `MarketStateChange_no_unspecified`, `…_trade_ref`, `…_detail_keys` (NOT VALID für Altzeilen)                                                                                                                                                                                              | Marktjournal mit Version und Formel-Details (§3.1)                   |
| `…_journal_context`        | Funktion `journal_no_truncate()` + Statement-Trigger `*_no_truncate` auf allen Journalen                                                                                                                                                                                                                                                                                                                 | TRUNCATE nur mit `app.allow_truncate` (G-3c)                         |
| `…_journal_context`        | `Player_user_iff_not_deleted`, `Player_deletedAt_iff_deleted`                                                                                                                                                                                                                                                                                                                                            | Löschstatus als Constraint (G-10a)                                   |

### 3.1 Marktzustands-Journal (T-105, seit `…_journal_context` fail-closed)

- **Auslöser:** `AFTER INSERT OR UPDATE` auf `MarketState`. Eine Zeile entsteht, wenn sich `stock`, `noise`, `activeEvent`, Stadt oder Ware ändert. Dann zählt `MarketState.version` hoch (Trigger `MarketState_version`). Ein reiner Countdown von `eventTicksLeft` erzeugt weder eine Zeile noch eine neue Version.
- **Kontext:** `setMarketChangeContext(tx, { cause, refId?, detail? })` setzt `app.market_change_cause`, `…_ref` und `…_detail` transaktionslokal. Tick und `correlationId` kommen aus dem Journalkontext.
- **fail-closed:**
  - Ein UPDATE ohne Ursache bricht mit `MARKET_CONTEXT_MISSING` ab; ein INSERT gilt als `INITIAL`.
  - Ohne Journalkontext bricht die Änderung mit `JOURNAL_CONTEXT_MISSING` ab.
  - `UNSPECIFIED` ist per CHECK verboten. Der Enum-Wert bleibt nur für Altzeilen, die bei der Migration zu `ADMIN` wurden.
- **Ursachen:** `INITIAL | TRADE | TICK | EVENT | NPC | ADMIN`.
- **Spalten je Zeile:**
  - `version`: lückenlos je Markt, unique.
  - `seq`: global fortlaufend.
  - `newEventTicksLeft`: Restdauer des Ereignisses.
  - `detail`: Zwischenwerte der Formel.
- **Pflichtschlüssel in `detail`** (CHECK `MarketStateChange_detail_keys`, Wunsch von Agent 5, REVIEW-v2 §5, Namen wie in `verify.py`):

  | Ursache | Pflichtschlüssel                                   | zusätzlich              |
  | ------- | -------------------------------------------------- | ----------------------- |
  | `TICK`  | `S_before`, `S_target`, `x_before`, `z`, `x_after` |                         |
  | `EVENT` | `event`, `u`, `shock`, `duration`                  |                         |
  | `NPC`   | `from`, `to`, `q`, `margin`, `theta`, `f`, `k`     |                         |
  | `TRADE` | `q`, `l_handel`, `spread`                          | `refId` Pflicht (CHECK) |

- **Schreibschutz:**
  - `UPDATE`/`DELETE` werfen `restrict_violation`.
  - `TRUNCATE` braucht `app.allow_truncate = 'on'`. Das setzt nur `truncateAll()` in den Tests, transaktionslokal.

### 3.2 Journalkontext (TD-022)

- **Aufruf:** `setJournalContext(tx, { tick, actor, correlationId? })` ruft `set_journal_context()` auf. Die Funktion setzt `app.tick`, `app.correlation_id`, `app.actor_type` und `app.actor_player_id` transaktionslokal.
- **Journalkopf:** Die Buchungsjournale (`MoneyTransaction`, `InventoryMovement`, `TradeTransaction`, `ClanTreasuryTransaction`) holen ihre Werte per DB-Default aus diesem Kontext:
  - `tick`, `correlationId` (UUID) und `actorType` per Default über `journal_context()`. Fehlt ein Wert, bricht die Anweisung mit `JOURNAL_CONTEXT_MISSING` ab.
  - `actorPlayerId` per BEFORE-INSERT-Trigger. Prisma introspektiert einen Default auf einer nullable Spalte nicht stabil, sonst gäbe es Drift.
  - CHECK `PLAYER ⇔ actorPlayerId`; FK `Restrict`.
- **`seq`** (BIGSERIAL, unique) ist die verlässliche Reihenfolge. `createdAt` ist innerhalb einer Transaktion gleich (G-3b). Lesende Abfragen nutzen `seq` als Tiebreaker.
- **Tick:** `currentTick()` liefert bis T-104 immer 0. CHECK `tick ≥ 0`; der FK auf `WorldTick` folgt mit T-104.
- **Altzeilen** (vor der Migration): `tick = 0`, je eine eigene `correlationId`, `actorType = SYSTEM`. Die Version der Marktzeilen ist nach `createdAt, seq` nummeriert.

## 4. Löschverhalten

| Von → nach                                                                                                                                                                | onDelete     | Grund                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `User` → `RefreshToken`                                                                                                                                                   | Cascade      | Sitzungen sind personenbezogen                                                                      |
| `User` → `Player`                                                                                                                                                         | **SetNull**  | Spieler bleibt pseudonymisiert erhalten (ADR-017)                                                   |
| `Player` → `MoneyTransaction`, `TradeTransaction`, `InventoryMovement`, `Travel`, `Combat` (attacker/defender), `ClanTreasuryTransaction`, `actorPlayerId` aller Journale | **Restrict** | Journale und Historie bleiben vollständig                                                           |
| `Player` → `InventoryLot`, `Vehicle`, `PlayerEquipment`, `PlayerCityHeat`, `ClanMember`, `ClanInvite` (Empfänger), `Message` (Empfänger), `Notification`                  | Cascade      | Zustand ohne Journalpflicht; die Kontolöschung entfernt ihn ohnehin explizit (`account.service.ts`) |
| `Combat.winner`, `Message.sender`, `ClanInvite.invitedBy`, `Player.currentCity`, `Travel.vehicle`                                                                         | SetNull      | –                                                                                                   |
| Katalog → Markt, Journale, Historie                                                                                                                                       | Restrict     | Historie bleibt                                                                                     |
| `Clan` → `ClanTreasuryTransaction`                                                                                                                                        | Restrict     | Clans werden aufgelöst (`dissolvedAt`), nicht gelöscht                                              |

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

| Vorschlag                                                                                              | Stand                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Pseudonymisierte Kontolöschung, Journale auf Restrict (ADR-017, D-1)                                   | ✅ v2                                                                                      |
| Append-only für alle Journale (D-2)                                                                    | ✅ v2                                                                                      |
| `InventoryMovement` + Lose (C-6)                                                                       | ✅ v2                                                                                      |
| `MoneyTransaction.account`, Gründe nach Quellen/Senken (B-5)                                           | ✅ v2                                                                                      |
| Schwarz-/Weißgeld (B-9)                                                                                | ✅ entschieden per ADR-023: `cash`/`bank`; Wäsche- und Beschlagnahme-Logik mit T-120/T-121 |
| Heat pro Stadt, Volumen, Float-Bestand, Katalog aus Parametern (B-11 … B-14)                           | ✅ v2                                                                                      |
| Clan-Kasse mit Journal (ADR-018)                                                                       | ✅ Schema v2; Endpunkte mit T-309                                                          |
| Journalkopf: Tick, `correlationId`, Akteur, `seq`; Marktjournal fail-closed (Review #40, G-1/2/3/3b/6) | ✅ `…_journal_context` (TD-022)                                                            |
| TRUNCATE-Schutz (G-3c), Löschstatus als CHECK (G-10a)                                                  | ✅ `…_journal_context`                                                                     |
| `WorldTick`, `ParameterSet` (idempotente Ticks, G-1/G-7, T-104)                                        | offen, mit T-104; dann FK `tick` → `WorldTick`                                             |
| `CommandLog` (Idempotenz-Schlüssel, C-5)                                                               | offen, vor den ersten Schreib-Endpunkten (T-106)                                           |
| `Npc`/`WorldState` mit Journal für die NPC-Intensität k (T-506)                                        | offen                                                                                      |
| Partitionierung/Archivierung der Journale (T-507)                                                      | Konzept in `docs/database/DATA_MODEL.md` §6                                                |
