# Frontend-Anforderungen an die API (T-107)

**Status:** Anforderungsdokument von Agent 4 (Frontend), Stand 2026-11-09.
**Verbindlich ist [`docs/api/API-CONTRACT.md`](../api/API-CONTRACT.md)** (ADR-011, Owner: Agent 3).
Dieses Dokument beschreibt nur noch, was das Frontend **zusätzlich** braucht, nämlich die Endpunkte und Felder, die
im verbindlichen Vertrag als „Noch nicht implementiert“ oder offen markiert sind. Sobald Agent 3 einen Punkt in den
Vertrag übernimmt, wird er hier gestrichen.

## Wie das Frontend den Vertrag nutzt

- **Rohformate** des Vertrags stehen 1:1 als TypeScript-Typen in `frontend/src/api/contract.ts`.
- **Übersetzung in UI-Modelle** übernimmt `frontend/src/api/adapters.ts`. Ändert sich ein Antwortformat, wird nur
  diese Datei angepasst; die Oberfläche bleibt unverändert.
- **Mocks:** Der Mock-Server (`frontend/src/mocks/`) antwortet im Vertragsformat. Für die Endpunkte unten nutzt er
  die hier beschriebenen Entwurfsformate. Er läuft nur in der Entwicklung (Production-Build: `off`, siehe T-110).

## Geld, Gewicht, Zeit

- **Geld:** ganzzahlige Cent als String (ADR-019). Das Frontend rechnet ausschließlich mit `BigInt` (`lib/money.ts`).
- **Gewicht/Laderaum:** Der Vertrag rechnet in Gramm (`unitWeightG`, `capacityG`), die Spielregeln (Agent 2) in
  Volumeneinheiten (`goods.*.volume`, Rucksack 60). **Offen:** einheitliche Größe festlegen. Der Mock setzt
  1 Volumeneinheit = 100 g.
- **Kapazität ohne Fahrzeug:** Laut Vertrag ist `capacityG` dann `null`. Das Frontend begrenzt in diesem Fall nicht
  selbst und überlässt die Prüfung dem Server. **Wunsch:** `capacityG` auch ohne Fahrzeug liefern (Rucksack).

## Benötigte Felder in bestehenden Endpunkten

| Endpunkt | Feld | Zweck |
|---|---|---|
| `GET /cities/:slug` → `connections[]` | `durationSeconds`, `cost` (Cent) | Reiseseite: Fahrzeit und Kosten vor dem Losfahren |
| `GET /players/me` | `experienceForNextLevel` | Fortschrittsbalken (bis dahin `null` → nur XP) |
| `GET /clans`, `GET /clans/:id` | optional `wealth`, `leaderName` | Clan-Karten; bis dahin leitet das UI den Paten aus `members` ab |
| `GET /cities/:slug/market` | optional `trend` (`UP`/`DOWN`/`FLAT`) | Bis dahin leitet das UI den Trend aus Folgeabrufen ab |

## Noch nicht implementierte Endpunkte (Entwurf)

Alle Antworten sind verpackt wie im Vertrag (`{ player }`, `{ travel }` …). `Player`, `Inventory`, `Vehicle`,
`Equipment`, `ClanDetail` und `Travel` entsprechen den Formaten aus `docs/api/API-CONTRACT.md`.

| Methode | Pfad | Body | Antwort |
|---|---|---|---|
| POST | `/players/me/start-city` | `{ cityId }` | `{ player }`, nur solange `currentCity == null`, sonst `409 START_CITY_ALREADY_SET` |
| POST | `/trade` | `{ cityId, commodityId, side: "BUY"\|"SELL", quantity }` | `{ player, inventory, transaction }` |
| POST | `/vehicles` | `{ vehicleTypeId }` | `201 { vehicle, player }` |
| POST | `/vehicles/:id/activate` | – | `{ vehicles }` |
| POST | `/vehicles/:id/sell` | – | `{ player }` |
| POST | `/equipment` | `{ equipmentTypeId }` | `201 { equipment, player }` |
| POST | `/travel` | `{ toCityId }` | `201 { travel }` |
| POST | `/clans` | `{ name, tag, description? }` | `201 { clan }` |
| POST | `/clans/:id/invites` | `{ playerName }` | `201 { invite }` |
| POST | `/clans/:id/leave` | – | `204` |
| POST | `/clan-invites/:id/accept` | – | `{ clan }` |
| POST | `/clan-invites/:id/decline` | – | `204` |

`transaction` = `{ id, cityId, commodityId, side, quantity, unitPrice, total, createdAt }` (Geld in Cent).

### Fehlercodes, die das UI gezielt übersetzt

`INSUFFICIENT_FUNDS`, `INSUFFICIENT_STOCK`, `INSUFFICIENT_CAPACITY`, `NOT_IN_CITY`, `PLAYER_BUSY`,
`ALREADY_IN_CLAN`, `NOT_IN_CLAN`, `FORBIDDEN`, `INVALID_PASSWORD`, `RATE_LIMITED`, sowie generisch
`*_NOT_FOUND` und `*_TAKEN` (Texte: `frontend/src/i18n/de.json` → `errors`).

## Echtzeit

Vorerst **Polling** (TanStack Query): Spieler 15 s, Markt 30 s, Ticker und Meldungen 20 s. Reise-Countdowns laufen
lokal bis `arrivesAt`, danach lädt der Client neu. **Wunsch für später:** `GET /api/v1/events` (SSE), das nur
Invalidierungs-Ereignisse schickt (`player`, `market:<city>`, `notifications`, `ticker`).

## Offene Punkte

1. Laderaum: Gramm (Vertrag) oder Volumeneinheiten (Spielregeln)? Kapazität ohne Fahrzeug?
2. Rechte-Matrix der Clan-Ränge (wer darf einladen?). Das UI erlaubt vorerst Pate, Consigliere und Capo
   (`docs/game-design/clans.md`, Abschnitt 3.1).
3. Ankünfte: `GET /travel/current` löst Ankünfte noch nicht auf. Das UI lädt nach Ablauf des Countdowns neu und
   zeigt bis zur Auflösung weiter „unterwegs“.
