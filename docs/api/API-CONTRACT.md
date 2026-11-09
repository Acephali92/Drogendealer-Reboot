# API-Vertrag v1 (Backend)

Basis-URL: `/api/v1`. Alle Antworten sind JSON.

## Konventionen

- **Auth:** Alle Endpunkte außer `/health` und `/auth/*` brauchen den Header `Authorization: Bearer <accessToken>`. Ohne gültiges Token kommt `401 INVALID_ACCESS_TOKEN`.
- **Fehler:** `{ "error": { "code": "STRING", "message": "…", "details"?: [{ "path", "message" }] } }`.
  `400 VALIDATION_ERROR`, `401`, `404 *_NOT_FOUND`, `409 *_TAKEN`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.
- **Geld:** Strings in **ganzen Spielwährungs-Einheiten**, **nicht** in Cent (`"cash": "1500"` = 1500). Grund: In der DB ist Geld `BigInt` und kann die Genauigkeit von JS-Zahlen übersteigen.
- **Zeit:** ISO-8601-Strings in UTC.
- **Pagination:** `?limit=20&offset=0` (`limit` 1–100). Antworten enthalten `total`, `limit` und `offset`.
- **Clan-Rollen:** `GODFATHER | CONSIGLIERE | CAPO | SOLDIER | ASSOCIATE`, angezeigt als Pate / Consigliere / Capo / Soldat / Mitläufer.

## Auth & System

| Methode | Pfad | Body | Antwort |
|---|---|---|---|
| GET | `/health` | – | `{ status, database }` |
| POST | `/auth/register` | `{ email, username, password, ageConfirmed: true }` | `201 { accessToken, refreshToken, user: { id, email, username, role, playerId } }` |
| POST | `/auth/login` | `{ login, password }` | wie register (`200`) |
| POST | `/auth/refresh` | `{ refreshToken }` | wie register (`200`), altes Refresh-Token ist danach ungültig |
| POST | `/auth/logout` | `{ refreshToken }` | `204` |

`ageConfirmed` ist Pflicht und muss genau `true` sein (Bestätigung „mindestens 18 Jahre“, ADR-013). Fehlt das Feld oder hat es einen anderen Wert, kommt `400 VALIDATION_ERROR`. Der Zeitpunkt der Bestätigung wird als `User.ageConfirmedAt` gespeichert.

## Spieler

### GET `/players/me`
```json
{ "player": {
  "id": "…", "name": "TonyM", "cash": "0", "bank": "0",
  "health": 100, "maxHealth": 100, "level": 1, "experience": 0,
  "experienceForNextLevel": null, "reputation": 0, "heat": 0,
  "status": "IDLE", "statusUntil": null, "createdAt": "…",
  "currentCity": { "id": "…", "slug": "berlin", "name": "Berlin" } | null,
  "clanId": "…" | null,
  "clan": { "id": "…", "name": "…", "tag": "…", "role": "GODFATHER" } | null
} }
```
`status`: `IDLE | TRAVELING | IN_COMBAT | HOSPITAL | JAIL`. `experienceForNextLevel` bleibt `null`, bis die Levelkurve feststeht.

### GET `/players/me/transactions?limit&offset`
`{ items: [{ id, amount, balanceAfter, reason, refId, createdAt }], total, limit, offset }`. Die neuesten Einträge kommen zuerst. `amount` ist negativ bei Ausgaben.
`reason`: `TRADE | TRAVEL | VEHICLE | EQUIPMENT | COMBAT | CLAN | BANK | ADMIN`.

### GET `/players/online`
`{ count, players: [{ id, name, level, clanTag }] }`. Als online gilt, wer in den letzten 5 Minuten eine authentifizierte Anfrage gestellt hat.

## Konto (Datenschutz, ADR-015 / T-306)

### GET `/players/me/export`
Liefert alle zum Konto gespeicherten Daten als JSON-Download (`Content-Disposition: attachment`, `Cache-Control: no-store`):
`{ exportedAt, formatVersion: 1, account: { id, email, username, role, createdAt, updatedAt, lastLoginAt, ageConfirmedAt }, sessions: [{ createdAt, expiresAt, revokedAt, ip, userAgent }], player: { …alle Spielerfelder, inventory, tradeTransactions, moneyTransactions, vehicles, travels, equipment, attacks, defenses, clanMembership, clanInvites, sentClanInvites, sentMessages, receivedMessages, notifications } }`.
Passwort-Hash und Token-Hashes sind nie enthalten. Erlaubt sind höchstens 5 Aufrufe pro Minute.

### DELETE `/players/me`
Body `{ password }`. Löscht das Konto endgültig, Antwort `204`. Bei falschem Passwort kommt `403 INVALID_PASSWORD`. Erlaubt sind höchstens 5 Aufrufe pro Minute.

Was dabei passiert:
- **Gelöscht:** Konto, Spieler, alle Sitzungen, Inventar, Transaktionen, Fahrzeuge, Reisen, Ausrüstung, Benachrichtigungen, empfangene Nachrichten und erhaltene Einladungen.
- **Kämpfe:** Kämpfe mit diesem Spieler verschwinden auch aus der Historie der Gegner.
- **Gesendete Nachrichten und Einladungen:** Sie bleiben beim Empfänger erhalten, der Absender wird `null`.
- **Clans:** Ein Clan ohne verbleibende Mitglieder wird mitgelöscht. Verlässt der Pate einen Clan, in dem noch andere Mitglieder sind, bleibt der Clan vorerst ohne Paten. Die Nachfolge-Regel ist eine offene Game-Design-Frage.
- **Laufende Access-Tokens:** Ein noch gültiges Access-Token findet danach keinen Spieler mehr. `/players/me` liefert dann `404 PLAYER_NOT_FOUND`.
- **Name und E-Mail:** Benutzername und E-Mail sind danach wieder frei.

## Welt & Markt

- **GET `/cities`**: Antwort `{ cities: [City] }`.
  `City` = `{ id, slug, name, description, country, techLevel, policeStrength, population }`.
- **GET `/cities/:slug`**: Antwort `{ city: City & { connections: [{ toCityId, toCity: { id, slug, name }, distanceKm }] } }`.
  Die Verbindungen sind nach Entfernung sortiert. `404 CITY_NOT_FOUND` bei unbekanntem Slug.
- **GET `/cities/:slug/market`**: Antwort `{ city: { id, slug, name }, prices: [{ commodity: Commodity, buyPrice, sellPrice, supply, updatedAt }] }`.
  `Commodity` = `{ id, slug, name, description, illegal, unitWeightG, basePrice }`.
- **GET `/market/overview`**: Antwort `{ commodities: [{ commodity, lowestBuy: { city, price, updatedAt }, highestSell: { city, price, updatedAt } }] }`.
  `lowestBuy` ist die günstigste Stadt zum Kaufen, `highestSell` die beste Stadt zum Verkaufen.

## Besitz

- **GET `/inventory`**: Antwort `{ items: [{ commodity, quantity, avgBuyPrice }], capacityG, usedG }`.
  - `capacityG` ist die Ladekapazität des aktiven Fahrzeugs, oder `null`, wenn keines aktiv ist.
  - `usedG` ist die Summe aus `quantity × unitWeightG`. Ausrüstung zählt hier noch nicht mit.
- **GET `/vehicle-types`**: Antwort `{ vehicleTypes: [{ id, slug, name, price, capacityG, speedKmh, licenseClass }] }`.
- **GET `/vehicles`**: Antwort `{ vehicles: [{ id, condition, isActive, purchasedAt, vehicleType }] }`.
- **GET `/equipment-types`**: Antwort `{ equipmentTypes: [{ id, slug, name, description, slot, attack, defense, weightG, price }] }`. `slot` ist `WEAPON` oder `ARMOR`.
- **GET `/equipment`**: Antwort `{ equipment: [{ id, equipped, acquiredAt, equipmentType }] }`.
- **GET `/travel/current`**: Antwort `{ travel: null }` oder `{ travel: { id, status, departedAt, arrivesAt, fromCity, toCity, vehicle: { id, vehicleType: { slug, name } } | null } }`.
  Ankünfte werden noch nicht automatisch aufgelöst, weil die Reiselogik fehlt.

## Clans & Soziales

- **GET `/clans?limit&offset`**: Antwort `{ clans: [{ id, name, tag, description, createdAt, memberCount }], total, limit, offset }`.
- **GET `/clans/:id`**: Antwort `{ clan: { id, name, tag, description, bank, createdAt, memberCount, members: [{ playerId, name, level, reputation, role, joinedAt }] } }`.
  - Die Mitglieder sind nach Rang sortiert.
  - `bank` sehen nur Mitglieder, für alle anderen ist das Feld `null`.
- **GET `/clan-invites`**: Antwort `{ invites: [{ id, createdAt, clan: { id, name, tag }, invitedBy: { id, name } | null }] }`. Enthält nur die eigenen offenen Einladungen.
- **GET `/rankings?type=wealth|reputation|level|clans&limit&offset`**: Antwort `{ type, total, limit, offset, entries }`.
  - Bei Spieler-Rankings sieht ein Eintrag so aus: `{ rank, player: { id, name, level, clanTag }, value }`.
  - Beim Typ `clans` sieht ein Eintrag so aus: `{ rank, clan: { id, name, tag, memberCount }, value }`.
  - `value` ist immer ein String.
  - wealth = cash + bank. clans = Clan-Bank + Vermögen aller Mitglieder; das ist eine vorläufige Definition, bis der Game Designer festlegt, wie Clans bewertet werden.
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
