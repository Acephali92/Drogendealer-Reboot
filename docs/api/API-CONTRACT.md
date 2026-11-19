# API-Vertrag v1 (Backend)

Basis-URL: `/api/v1`. Alle Antworten sind JSON.

## Konventionen

- **Auth:** Alle Endpunkte außer `/health`, `/images` und `/auth/*` brauchen den Header `Authorization: Bearer <accessToken>`. Ohne gültiges Token kommt `401 INVALID_ACCESS_TOKEN`.
- **Fehler:** `{ "error": { "code": "STRING", "message": "…", "details"?: [{ "path", "message" }] } }`.
  `400 VALIDATION_ERROR`, `401`, `404 *_NOT_FOUND`, `409 *_TAKEN`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.
- **Geld (ADR-019):** Alle Beträge sind **ganzzahlige Cent** als String (`"cash": "150000"` = 1.500,00 €). Das gilt für alle Geldfelder (`cash`, `bank`, Preise, `amount`, `balanceAfter`, `value` in Ranglisten …). Gleitkommazahlen kommen nicht vor; in Euro umgerechnet wird nur bei der Anzeige. Grund für den String: In der DB ist Geld `BigInt` und kann die Genauigkeit von JS-Zahlen übersteigen.
- **Zeit:** ISO-8601-Strings in UTC.
- **Pagination:** `?limit=20&offset=0` (`limit` 1–100). Antworten enthalten `total`, `limit` und `offset`.
- **Clan-Rollen:** `GODFATHER | CONSIGLIERE | CAPO | SOLDIER | ASSOCIATE`, angezeigt als Pate / Consigliere / Capo / Soldat / Mitläufer.
- **Bilder (ADR-020, T-114):** Waren (`Commodity`), Fahrzeugtypen und Ausrüstungstypen haben das Feld `image`.
  - Der Wert ist ein relativer Pfad unter `images/` (z. B. `"goods/gras.webp"`) oder `null`.
  - Er stammt aus `parameters.toml` und wird nicht in der Datenbank gespeichert. Zugeordnet wird über den technischen Schlüssel (`slug`). Ausrüstung wird je nach `slot` unter `weapons` bzw. `armor` gesucht.
  - Das Frontend lädt `${BASE_URL}images/<image>`. Fehlt das Bild, nimmt es den Kategorie-Fallback aus `GET /images`.

## Auth & System

| Methode | Pfad             | Body                                                | Antwort                                                                                                                                                                                                                                                  |
| ------- | ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/health`        | –                                                   | `{ status, database }`                                                                                                                                                                                                                                   |
| GET     | `/images`        | –                                                   | `{ fallback: { goods, vehicles, weapons, armor, crew, ships }, allowedExtensions }`. Jeder Fallback ist ein relativer Pfad oder `null`, z. B. `"goods/_fallback.svg"`. `allowedExtensions` ist z. B. `[".webp", ".png", ".svg"]`. Öffentlich, ohne Token |
| POST    | `/auth/register` | `{ email, username, password, ageConfirmed: true }` | `201 { accessToken, refreshToken, user: { id, email, username, role, playerId } }`                                                                                                                                                                       |
| POST    | `/auth/login`    | `{ login, password }`                               | wie register (`200`)                                                                                                                                                                                                                                     |
| POST    | `/auth/refresh`  | `{ refreshToken }`                                  | wie register (`200`), altes Refresh-Token ist danach ungültig                                                                                                                                                                                            |
| POST    | `/auth/logout`   | `{ refreshToken }`                                  | `204`                                                                                                                                                                                                                                                    |

`ageConfirmed` ist Pflicht und muss genau `true` sein (Bestätigung „mindestens 18 Jahre“, ADR-013). Fehlt das Feld oder hat es einen anderen Wert, kommt `400 VALIDATION_ERROR`. Der Zeitpunkt der Bestätigung wird als `User.ageConfirmedAt` gespeichert.

## Breaking Changes mit Datenmodell v2 (Freigabe nach ADR-011, Nachtrag)

Grundsatz: Katalogwerte (Waren, Orte, Fahrzeuge, Ausrüstung) kommen ausschließlich aus `parameters.toml`. Werte, die das Game Design nicht kennt, entfallen.

| Endpunkt / Objekt              | Entfernt                                                              | Neu / umbenannt                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `City`                         | `description`, `country`, `techLevel`, `policeStrength`, `population` | `realm` (`earth`/`space`), `pop` (Tsd. Einwohner), `wealth`, `police` (0–1), `fuelPrice` (ct/l, String), `spaceport`                                                                                       |
| `Commodity`                    | `description`, `illegal`, `unitWeightG`                               | `realm`, `unitVolume` (Volumeneinheiten je Einheit). `basePrice` kommt jetzt aus den Parametern                                                                                                            |
| `GET /cities/:slug/market`     | `prices[]` mit `buyPrice`, `sellPrice`, `supply`                      | `markets[]` mit `stock` (Float), `referencePrice` (Gleichgewichtspreis F-ECO-07, String), `activeEvent`, `eventTicksLeft`. Kauf- und Verkaufspreise je Order: Formeln seit T-103, Endpunkt folgt mit T-106 |
| `GET /market/overview`         | `lowestBuy`, `highestSell`                                            | `lowestPrice`, `highestPrice` je `{ city, referencePrice }`                                                                                                                                                |
| `GET /inventory`               | `capacityG`, `usedG`                                                  | `capacity`, `used` in Volumeneinheiten (T-119). `capacity` ist nie `null`: Rucksack + aktives Fahrzeug                                                                                                     |
| `VehicleType`                  | `capacityG`, `licenseClass`                                           | `capacity` (VE), `consumptionPer100Km` (l), `hide`                                                                                                                                                         |
| `EquipmentType`                | `description`, `attack`, `defense`, `weightG`                         | `strength`. `name` kommt aus den Parametern und ist `null`, solange ein Eintrag keinen Namen hat (T-117)                                                                                                   |
| `player.heat`                  | –                                                                     | Wert der **aktuellen Stadt** als Float (Heat gilt pro Spieler und Stadt), ohne Stadt 0                                                                                                                     |
| `GET /players/me/transactions` | alte `reason`-Werte                                                   | `account` (`CASH`/`BANK`), neue `reason`-Werte (siehe dort)                                                                                                                                                |
| `GET /clans/:id`               | `bank`                                                                | `treasury: { cash, bank } \| null` (nur für Mitglieder)                                                                                                                                                    |
| `GET /players/me/export`       | `formatVersion: 1`, `inventory`                                       | `formatVersion: 2` mit `inventoryLots`, `inventoryMovements`, `heat`, `clanTreasuryTxs`                                                                                                                    |
| `DELETE /players/me`           | Verhalten „alles löschen“                                             | Pseudonymisierung laut ADR-017 (Antwort unverändert `204`)                                                                                                                                                 |

## Spieler

### GET `/players/me`

```json
{ "player": {
  "id": "…", "name": "TonyM", "cash": "200000", "bank": "0",
  "health": 100, "maxHealth": 100, "level": 1, "experience": 0,
  "experienceForNextLevel": null, "reputation": 0, "heat": 0,
  "status": "IDLE", "statusUntil": null, "createdAt": "…",
  "currentCity": { "id": "…", "slug": "berlin", "name": "Pleitenberg" } | null,
  "clanId": "…" | null,
  "clan": { "id": "…", "name": "…", "tag": "…", "role": "GODFATHER" } | null
} }
```

- `cash` ist das **Bargeld** (Schwarzgeld, mitgeführt), `bank` das **Bankkonto** (gewaschen), siehe ADR-023.
- Neue Spieler starten mit `player.start_cash_black`/`start_cash_white` aus `parameters.toml`. Diese Werte werden als `START_CAPITAL` im Kontobuch gebucht.
- `heat` ist der Fahndungsdruck in der aktuellen Stadt (Float 0–100).
- `status`: `IDLE | TRAVELING | IN_COMBAT | HOSPITAL | JAIL` (gelöschte Spieler: `DELETED`, nie über die API sichtbar).
- `experienceForNextLevel` bleibt `null`, bis die Levelkurve feststeht.

### GET `/players/me/transactions?limit&offset`

`{ items: [{ id, account, amount, balanceAfter, reason, refId, createdAt }], total, limit, offset }`.

- Die neuesten Einträge kommen zuerst. `amount` ist negativ bei Ausgaben.
- `account`: `CASH | BANK`. `balanceAfter` ist der Saldo **dieses** Kontos nach der Buchung.
- `reason` (Quellen und Senken laut `docs/database/DATA_MODEL.md` §4): `START_CAPITAL | TRADE_BUY | TRADE_SELL | TRAVEL_FUEL | TRAVEL_TICKET | BRIBE | CONFISCATION | VEHICLE_BUY | VEHICLE_SALE | EQUIPMENT_BUY | EQUIPMENT_SALE | CREW | LOOT_GAINED | LOOT_LOST | LAUNDERING | BUSINESS_INCOME | BUSINESS_UPKEEP | CLAN_DEPOSIT | CLAN_PAYOUT | CLAN_TAX | EMERGENCY_LOAN | LOAN_REPAYMENT | ACCOUNT_DELETION | ADMIN`.

### GET `/players/online`

`{ count, players: [{ id, name, level, clanTag }] }`. Als online gilt, wer in den letzten 5 Minuten eine authentifizierte Anfrage gestellt hat.

## Konto (Datenschutz, ADR-015 / ADR-017)

### GET `/players/me/export`

Liefert alle zum Konto gespeicherten Daten als JSON-Download (`Content-Disposition: attachment`, `Cache-Control: no-store`):
`{ exportedAt, formatVersion: 2, account: { id, email, username, role, createdAt, updatedAt, lastLoginAt, ageConfirmedAt }, sessions: [{ createdAt, expiresAt, revokedAt, ip, userAgent }], player: { …alle Spielerfelder, currentCity, heat, inventoryLots, inventoryMovements, tradeTransactions, moneyTransactions, vehicles, travels, equipment, attacks, defenses, clanMembership, clanInvites, sentClanInvites, clanTreasuryTxs, sentMessages, receivedMessages, notifications } }`.

- Katalogeinträge erscheinen mit ihrem technischen Schlüssel (`slug`).
- Passwort-Hash und Token-Hashes sind nie enthalten.
- Erlaubt sind höchstens 5 Aufrufe pro Minute (ENV `ACCOUNT_RATE_LIMIT_MAX`).

### DELETE `/players/me`

Body `{ password }`. Antwort `204`. Bei falschem Passwort kommt `403 INVALID_PASSWORD`. Erlaubt sind höchstens 5 Aufrufe pro Minute.

Was dabei passiert (ADR-017, Details in `docs/database/DATA_MODEL.md` §5):

- **Gelöscht:** Konto, alle Sitzungen, Benachrichtigungen, empfangene Nachrichten, offene Einladungen, Fahrzeuge, Ausrüstung, Heat.
- **Pseudonymisiert:** Der Spieler bleibt als „Gelöschter Spieler #…“ (Status `DELETED`) in Kontobuch, Handel, Reisen und Kämpfen erhalten. Er erscheint nicht mehr in Ranglisten und in der Online-Liste.
- **Vermögen verfällt:** Bargeld, Bankkonto und Waren werden per Journalbuchung `ACCOUNT_DELETION` auf 0 gesetzt. Die Waren gehen nicht zurück in die Märkte.
- **Gesendete Nachrichten:** bleiben beim Empfänger, der Text wird durch „[gelöscht]“ ersetzt.
- **Clans:** Austritt. Ein Clan ohne verbleibende Mitglieder wird aufgelöst, seine Kasse verfällt, und er erscheint nicht mehr in Listen und Ranglisten.
- **Laufende Access-Tokens** finden keinen Spieler mehr: `/players/me` liefert `404 PLAYER_NOT_FOUND`.
- **Name und E-Mail** sind danach wieder frei.

## Welt & Markt

- **GET `/cities`**: Antwort `{ cities: [City] }`. Zuerst die Erdstädte, dann die Orte im Weltraum, jeweils nach Name sortiert.
  `City` = `{ id, slug, name, realm, pop, wealth, police, fuelPrice, spaceport }`. Alle Werte stammen aus `[city.*]` bzw. `[space_location.*]`. `name` ist der fiktive Anzeigename, `slug` der technische Schlüssel (ADR-013).
- **GET `/cities/:slug`**: Antwort `{ city: City & { connections: [{ toCityId, toCity: { id, slug, name }, distanceKm }] } }`.
  - Die Straßenverbindungen kommen aus `[distances]` und sind nach Entfernung sortiert.
  - Reisedauer und -kosten je Option folgen mit T-119 (`travelOptions`).
  - `404 CITY_NOT_FOUND` bei unbekanntem Slug.
- **GET `/cities/:slug/market`**: Antwort `{ city: { id, slug, name }, markets: [{ commodity: Commodity, stock, referencePrice, activeEvent, eventTicksLeft, updatedAt }] }`.
  - `Commodity` = `{ id, slug, name, realm, basePrice, unitVolume, image }`.
  - `stock` ist der Marktbestand (Kommazahl).
  - `referencePrice` ist der Gleichgewichtspreis P* nach F-ECO-07 in Cent (String, kaufmännisch gerundet). Er dient nur zur Anzeige.
  - Kauf- und Verkaufspreise für eine konkrete Menge berechnen `buyCost`/`sellRevenue` (T-103). Ausgeliefert werden sie mit T-106.
- **GET `/market/overview`**: Antwort `{ commodities: [{ commodity, lowestPrice: { city, referencePrice }, highestPrice: { city, referencePrice } }] }`.

## Besitz

- **GET `/inventory`**: Antwort `{ items: [{ commodity, quantity, avgBuyPrice }], capacity, used }`. Laderaum in Volumeneinheiten (T-119):
  - `capacity` = `player.backpack_capacity` + `capacity` des aktiven Fahrzeugs (nie `null`).
  - `used` = Σ `quantity × commodity.unitVolume`.
  - `avgBuyPrice` = Einstandskosten ÷ Menge, abgerundet (Cent, String).
- **GET `/vehicle-types`**: Antwort `{ vehicleTypes: [{ id, slug, name, price, speedKmh, consumptionPer100Km, capacity, hide, image }] }`. Sortiert nach Preis, Werte aus `[vehicles.*]`.
- **GET `/vehicles`**: Antwort `{ vehicles: [{ id, condition, isActive, purchasedAt, vehicleType }] }`.
- **GET `/equipment-types`**: Antwort `{ equipmentTypes: [{ id, slug, slot, name, strength, price, image }] }`. `slot` ist `WEAPON` oder `ARMOR`; zuerst kommen die Waffen, jeweils nach Preis sortiert.
- **GET `/equipment`**: Antwort `{ equipment: [{ id, equipped, acquiredAt, equipmentType }] }`.
- **GET `/travel/current`**: Antwort `{ travel: null }` oder `{ travel: { id, status, departedAt, arrivesAt, fromCity, toCity, vehicle: { id, vehicleType } | null } }`.
  Ankünfte werden noch nicht automatisch aufgelöst, weil die Reiselogik fehlt.

## Clans & Soziales

- **GET `/clans?limit&offset`**: Antwort `{ clans: [{ id, name, tag, description, createdAt, memberCount }], total, limit, offset }`. Aufgelöste Clans sind nicht enthalten.
- **GET `/clans/:id`**: Antwort `{ clan: { id, name, tag, description, treasury, createdAt, memberCount, members: [{ playerId, name, level, reputation, role, joinedAt }] } }`.
  - Die Mitglieder sind nach Rang sortiert.
  - `treasury` = `{ cash, bank }` (Clan-Kasse, ADR-018) sehen nur Mitglieder; für alle anderen ist das Feld `null`.
  - Aufgelöste Clans liefern `404 CLAN_NOT_FOUND`.
- **GET `/clan-invites`**: Antwort `{ invites: [{ id, createdAt, clan: { id, name, tag }, invitedBy: { id, name } | null }] }`. Enthält nur die eigenen offenen Einladungen.
- **GET `/rankings?type=wealth|reputation|level|clans&limit&offset`**: Antwort `{ type, total, limit, offset, entries }`.
  - Bei Spieler-Rankings sieht ein Eintrag so aus: `{ rank, player: { id, name, level, clanTag }, value }`.
  - Beim Typ `clans` sieht ein Eintrag so aus: `{ rank, clan: { id, name, tag, memberCount }, value }`.
  - `value` ist immer ein String. Gelöschte Spieler und aufgelöste Clans werden nicht gelistet.
  - wealth = cash + bank. clans = Clan-Kasse (cash + bank) + Vermögen aller Mitglieder; das ist eine vorläufige Definition, bis Agent 2 festlegt, wie Clans bewertet werden.
- **GET `/notifications?unreadOnly=true|false&limit&offset`**: Antwort `{ items: [{ id, type, title, body, data, readAt, createdAt }], total, unreadCount, limit, offset }`.
- **POST `/notifications/:id/read`**: Antwort `{ notification }`. Mehrfaches Aufrufen schadet nicht. Bei fremden IDs kommt `404 NOTIFICATION_NOT_FOUND`.
- **POST `/notifications/read-all`**: Antwort `{ updated }`.
- **GET `/ticker?limit`**: Antwort `{ events: [{ id, type, message, data, createdAt }] }`. Standard sind 50 Einträge, höchstens 100. Die neuesten kommen zuerst.

## Noch nicht implementiert

Diese Endpunkte warten auf die Regeln des Game Designers. Das Frontend simuliert sie bis dahin (Entwurf: `docs/frontend/API-CONTRACT.md`).

- `POST /players/me/start-city`
- `POST /trade`
- `POST /vehicles`, `/vehicles/:id/activate`, `/vehicles/:id/sell`
- `POST /equipment`
- `POST /travel`
- `POST /clans`, `/clans/:id/invites`, `/clans/:id/leave`
- `POST /clan-invites/:id/accept|decline`

Ebenfalls noch offen: `durationSeconds` und `cost` an den Stadtverbindungen. Beides hängt von den Fahrzeug- und Reiseregeln ab.
