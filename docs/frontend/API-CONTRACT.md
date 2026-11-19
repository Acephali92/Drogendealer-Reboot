# Frontend-Anforderungen an die API (T-107)

**Status:** Anforderungsdokument von Agent 4 (Frontend), Stand 2026-11-19 (Datenmodell v2).
**Verbindlich ist [`docs/api/API-CONTRACT.md`](../api/API-CONTRACT.md)** (ADR-011, Owner: Agent 3).
Dieses Dokument beschreibt nur, was das Frontend **zusätzlich** braucht: die Endpunkte, die im Vertrag noch als
„Noch nicht implementiert“ stehen, und offene Wünsche. Sobald Agent 3 einen Punkt übernimmt, wird er hier gestrichen.

## Wie das Frontend den Vertrag nutzt

- **Rohformate** des Vertrags stehen 1:1 als TypeScript-Typen in `frontend/src/api/contract.ts`.
- **Übersetzung in UI-Modelle** übernimmt `frontend/src/api/adapters.ts`. Ändert sich ein Antwortformat, wird nur
  diese Datei angepasst; die Oberfläche bleibt unverändert.
- **Mocks:** Der Mock-Server (`frontend/src/mocks/`) antwortet im Vertragsformat und liest alle Katalogwerte beim
  Build aus `docs/game-design/parameters.toml`. Für die Endpunkte unten nutzt er die hier beschriebenen
  Entwurfsformate. Er läuft nur in der Entwicklung (Production-Build: `off`).

## Einheiten (geklärt)

- **Geld:** ganzzahlige Cent als String (ADR-019). Das Frontend rechnet nur mit `BigInt` (`lib/money.ts`).
- **Bargeld/Bankkonto:** `cash` = Schwarzgeld, `bank` = Weißgeld (ADR-023). Das UI zeigt beide getrennt; das
  Kontobuch zeigt `account` (`CASH`/`BANK`) je Buchung.
- **Laderaum:** Volumeneinheiten (VE), `capacity` = Rucksack + aktives Fahrzeug (T-119). Anzeige z. B. „60 VE“.
- **Heat:** Wert der aktuellen Stadt (Float), das UI rundet für die Anzeige.

## Noch nicht implementierte Endpunkte (Entwurf)

Antworten sind verpackt wie im Vertrag (`{ player }`, `{ travel }` …). `Player`, `Inventory`, `Vehicle`,
`Equipment`, `ClanDetail` und `Travel` entsprechen den Formaten aus `docs/api/API-CONTRACT.md`.

| Methode | Pfad                         | Body                                                     | Antwort                                                                                 |
| ------- | ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST    | `/players/me/start-city`     | `{ cityId }`                                             | `{ player }`, nur solange `currentCity == null`, sonst `409 START_CITY_ALREADY_SET`      |
| POST    | `/trade`                     | `{ cityId, commodityId, side: "BUY"\|"SELL", quantity }` | `{ player, inventory, transaction }`; bucht auf `CASH` (`TRADE_BUY`/`TRADE_SELL`)       |
| POST    | `/vehicles`                  | `{ vehicleTypeId }`                                      | `201 { vehicle, player }`                                                               |
| POST    | `/vehicles/:id/activate`     | –                                                        | `{ vehicles }`                                                                          |
| POST    | `/vehicles/:id/sell`         | –                                                        | `{ player }`                                                                            |
| POST    | `/equipment`                 | `{ equipmentTypeId }`                                    | `201 { equipment, player }`                                                             |
| POST    | `/travel`                    | `{ toCityId, mode: "train"\|"vehicle" }`                 | `201 { travel }`; bucht `TRAVEL_TICKET` bzw. `TRAVEL_FUEL`                              |
| POST    | `/clans`                     | `{ name, tag, description? }`                            | `201 { clan }`; Gründungskosten vom Bankkonto (`clans.founding_cost`, Weißgeld)         |
| POST    | `/clans/:id/invites`         | `{ playerName }`                                         | `201 { invite }` (einladen dürfen GODFATHER, CONSIGLIERE, CAPO)                          |
| POST    | `/clans/:id/leave`           | –                                                        | `204`                                                                                   |
| POST    | `/clan-invites/:id/accept`   | –                                                        | `{ clan }`                                                                              |
| POST    | `/clan-invites/:id/decline`  | –                                                        | `204`                                                                                   |

`transaction` = `{ id, cityId, commodityId, side, quantity, unitPrice, total, createdAt }` (Geld in Cent).

### Reiseoptionen (T-119, Vorschlag Agent 3)

`GET /cities/:slug` → `connections[].travelOptions: [{ mode: "train"|"vehicle", vehicleId?, durationSeconds, cost }]`

- `train`: immer verfügbar, Dauer nach F-TRV-01 mit `travel.train_speed`, Kosten F-TRV-03. Nur möglich, wenn die
  Ladung in den Rucksack passt; sonst `409 CARGO_TOO_LARGE_FOR_TRAIN`.
- `vehicle`: nur mit aktivem Fahrzeug, Dauer F-TRV-01 mit `speed`, Kosten F-TRV-02 (Spritpreis der Startstadt).
- `durationSeconds` = Ticks · 600. Das UI zeigt beide Optionen zur Wahl, die günstigste als „ab …“.

### Handelspreise (T-103)

Bis T-103 zeigt das UI den **Richtpreis** (`referencePrice`) und rechnet Schätzungen damit. Für eine verlässliche
Vorschau vor dem Kauf wünscht sich das Frontend:

`GET /cities/:slug/market/quote?commodityId&side&quantity` → `{ unitPrice, total, maxQuantity, limitedBy }`

`limitedBy`: `CASH | CAPACITY | STOCK | OWNED`. Damit kann der Mengen-Regler „Max“ exakt anzeigen.

### Fehlercodes, die das UI gezielt übersetzt

`INSUFFICIENT_FUNDS`, `INSUFFICIENT_STOCK`, `INSUFFICIENT_CAPACITY`, `NOT_IN_CITY`, `PLAYER_BUSY`,
`CARGO_TOO_LARGE_FOR_TRAIN`, `TRAVEL_MODE_UNAVAILABLE`, `START_CITY_ALREADY_SET`, `ALREADY_IN_CLAN`, `NOT_IN_CLAN`,
`FORBIDDEN`, `INVALID_PASSWORD`, `RATE_LIMITED`, sowie generisch `*_NOT_FOUND` und `*_TAKEN`
(Texte: `frontend/src/i18n/de.json` → `errors`).

## Anzeigenamen

- `activeEvent` im Markt ist ein Schlüssel. Das UI zeigt den Namen aus `[events.<schlüssel>] name`
  (`parameters.toml`, beim Build eingelesen), nie den Schlüssel (T-112).
- `EquipmentType.name == null`: Das UI zeigt „Namenlose Waffe“ bzw. „Namenloser Schutz“, nie den `slug`.

## Echtzeit

Vorerst **Polling** (TanStack Query): Spieler 15 s, Markt 30 s, Ticker und Meldungen 20 s. Reise-Countdowns laufen
lokal bis `arrivesAt`, danach lädt der Client neu. **Wunsch für später:** `GET /api/v1/events` (SSE), das nur
Invalidierungs-Ereignisse schickt (`player`, `market:<city>`, `notifications`, `ticker`).

## Offene Punkte

1. Ankünfte: `GET /travel/current` löst Ankünfte noch nicht auf. Das UI lädt nach Ablauf des Countdowns neu.
2. Trend: Der Markt liefert keinen Trend; das UI leitet ihn aus aufeinanderfolgenden Richtpreisen ab.
