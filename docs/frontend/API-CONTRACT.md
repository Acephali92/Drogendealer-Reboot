# API-Vertrag Frontend ↔ Backend (Entwurf)

**Status:** Vorschlag von Agent 4 (Frontend) an Agent 3 (Backend). Stand: 2026-11-08.
Die Mock-Schicht des Frontends (`frontend/src/mocks/`) implementiert genau diesen Vertrag. Sobald ein Endpunkt
im Backend existiert, wird der zugehörige Mock-Handler entfernt – am UI-Code ändert sich nichts.

## Grundregeln

| Thema | Festlegung |
|---|---|
| Basis-URL | `/api/v1` (Vite-Dev-Proxy leitet auf `http://localhost:3000`) |
| Format | JSON, `camelCase` |
| Auth | `Authorization: Bearer <accessToken>` (JWT, 15 min). Refresh über `POST /auth/refresh` mit Rotation. |
| Geld | **Ganzzahl in Cent als String** (`"3000000"` = 30.000,00 €). Das Frontend rechnet nur mit `BigInt`. |
| Gewicht | Ganzzahl in **Gramm** (`unitWeightG`, `capacityG`). Anzeige als g/kg. |
| Zeit | ISO-8601 in UTC (`arrivesAt`, `statusUntil`, `createdAt`). Countdowns rechnet der Client. |
| Fehler | `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "…" } }` mit passendem HTTP-Status |
| IDs | Strings (cuid) |
| CORS | `CORS_ORIGIN=http://localhost:5173` für die Entwicklung |

Erwartete Fehlercodes (Frontend übersetzt sie in `i18n/de/errors.json`):
`VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `USERNAME_TAKEN`, `NOT_FOUND`,
`INSUFFICIENT_FUNDS`, `INSUFFICIENT_STOCK`, `INSUFFICIENT_CAPACITY`, `NOT_IN_CITY`, `PLAYER_BUSY`
(reist / Krankenhaus / Knast), `ALREADY_IN_CLAN`, `NOT_IN_CLAN`, `CLAN_NAME_TAKEN`, `FORBIDDEN`, `RATE_LIMITED`.

## Bereits vom Backend geplant (Agent 3)

| Methode | Pfad | Antwort |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` |
| POST | `/auth/register` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/login` | `{ accessToken, refreshToken, user }` – Body `{ login, password }` |
| POST | `/auth/refresh` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | `204` |
| GET | `/players/me` | `Player` |

## Vorschlag: Spiel-Endpunkte

| Methode | Pfad | Body | Antwort |
|---|---|---|---|
| GET | `/cities` | – | `City[]` |
| GET | `/cities/:slug` | – | `CityDetail` (inkl. `connections`) |
| GET | `/cities/:slug/market` | – | `MarketEntry[]` |
| GET | `/market/overview` | – | `MarketOverview` |
| POST | `/players/me/start-city` | `{ cityId }` | `Player` (nur solange `currentCityId == null`) |
| POST | `/trade` | `{ cityId, commodityId, side: "BUY"\|"SELL", quantity }` | `TradeResult` |
| GET | `/inventory` | – | `Inventory` |
| GET | `/vehicle-types` | – | `VehicleType[]` |
| GET | `/vehicles` | – | `Vehicle[]` |
| POST | `/vehicles` | `{ vehicleTypeId }` | `{ vehicle, player }` |
| POST | `/vehicles/:id/activate` | – | `Vehicle[]` |
| POST | `/vehicles/:id/sell` | – | `{ player }` |
| GET | `/equipment-types` | – | `EquipmentType[]` (Waffen-/Rüstungshändler der Stadt) |
| GET | `/equipment` | – | `PlayerEquipment[]` |
| POST | `/equipment` | `{ equipmentTypeId }` | `{ equipment, player }` |
| POST | `/travel` | `{ toCityId }` | `Travel` |
| GET | `/travel/current` | – | `Travel \| null` |
| GET | `/clans` | – | `ClanSummary[]` |
| GET | `/clans/:id` | – | `ClanDetail` |
| POST | `/clans` | `{ name, tag, description? }` | `ClanDetail` |
| POST | `/clans/:id/invites` | `{ playerName }` | `ClanInvite` |
| GET | `/clan-invites` | – | `ClanInvite[]` (eigene, offene) |
| POST | `/clan-invites/:id/accept` · `/decline` | – | `ClanDetail` · `204` |
| POST | `/clans/:id/leave` | – | `204` |
| GET | `/rankings?type=wealth\|reputation\|level\|clans&limit=50` | – | `Ranking` |
| GET | `/notifications` | – | `Notification[]` (neueste zuerst) |
| POST | `/notifications/:id/read` · `/notifications/read-all` | – | `204` |
| GET | `/players/me/transactions?limit=50` | – | `MoneyTransaction[]` |
| GET | `/ticker` | – | `TickerEvent[]` (öffentliche Meldungen: „XY erreicht die Stadt Madrid“) |
| GET | `/players/online` | – | `{ count: number }` |

## Datentypen (TypeScript, maßgeblich: `frontend/src/api/types.ts`)

Feldnamen folgen dem Prisma-Modell von Agent 3. **Zusätzliche Felder** gegenüber dem Prisma-Entwurf sind mit ➕ markiert.

```ts
type Money = string;        // Cent als Ganzzahl-String
type PlayerStatus = 'IDLE' | 'TRAVELING' | 'IN_COMBAT' | 'HOSPITAL' | 'JAIL';

interface Player {
  id: string; name: string;
  cash: Money; bank: Money;
  health: number; maxHealth: number;
  level: number; experience: number; experienceForNextLevel: number; // ➕
  reputation: number;
  heat: number;               // ➕ Fahndungslevel 0–100 (Agent 2)
  currentCityId: string | null;
  status: PlayerStatus; statusUntil: string | null;
  clanId: string | null;      // ➕ bequem fürs UI
  createdAt: string;
}

interface City {
  id: string; slug: string; name: string; country: string; // ➕ country
  description?: string;
  techLevel: number;          // ➕ wie im Original („Tech Level der Stadt“)
  policeStrength: number;     // ➕ 0–100 (Agent 2)
  population: number;         // ➕
}
interface CityConnection { toCityId: string; distanceKm: number; durationSeconds: number; cost: Money }
interface CityDetail extends City { connections: CityConnection[] }

interface Commodity {
  id: string; slug: string; name: string; description?: string;
  illegal: boolean;           // ➕
  unitWeightG: number;        // ➕ Gewicht pro Einheit in g
  basePrice: Money; minPrice: Money; maxPrice: Money;
}
interface MarketEntry {
  commodity: Commodity;
  buyPrice: Money; sellPrice: Money; supply: number;
  trend: 'UP' | 'DOWN' | 'FLAT';  // ➕ gegenüber letztem Tick
  updatedAt: string;
}
interface MarketOverview {
  cities: City[]; commodities: Commodity[];
  prices: Record<string /*cityId*/, Record<string /*commodityId*/, { buyPrice: Money; sellPrice: Money; trend: MarketEntry['trend'] }>>;
}

interface InventoryItem { commodity: Commodity; quantity: number; avgBuyPrice: Money } // ➕ avgBuyPrice
interface Inventory { items: InventoryItem[]; capacityG: number; usedG: number }

interface TradeTransaction {
  id: string; cityId: string; commodityId: string; side: 'BUY' | 'SELL';
  quantity: number; unitPrice: Money; total: Money; createdAt: string;
}
interface TradeResult { player: Player; inventory: Inventory; transaction: TradeTransaction }

interface VehicleType { id: string; slug: string; name: string; price: Money; capacityG: number; speedKmh: number; licenseClass: number }
interface Vehicle { id: string; vehicleType: VehicleType; condition: number; isActive: boolean; purchasedAt: string }

interface EquipmentType { id: string; slug: string; name: string; description?: string; slot: 'WEAPON' | 'ARMOR'; attack: number; defense: number; price: Money; weightG: number }
interface PlayerEquipment { id: string; equipmentType: EquipmentType; equipped: boolean }

interface Travel {
  id: string; fromCityId: string; toCityId: string; vehicleId: string | null;
  departedAt: string; arrivesAt: string; status: 'IN_PROGRESS' | 'ARRIVED' | 'CANCELLED';
}

type ClanRole = 'LEADER' | 'OFFICER' | 'MEMBER';
interface ClanSummary { id: string; name: string; tag: string; memberCount: number; wealth: Money; leaderName: string }
interface ClanMember { playerId: string; name: string; role: ClanRole; level: number; joinedAt: string }
interface ClanDetail extends ClanSummary { description?: string; bank: Money; members: ClanMember[]; createdAt: string }
interface ClanInvite { id: string; clan: ClanSummary; invitedByName: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED'; createdAt: string }

type RankingType = 'wealth' | 'reputation' | 'level' | 'clans';
interface RankingRow { rank: number; id: string; name: string; tag?: string; value: string; isMe: boolean }
interface Ranking { type: RankingType; rows: RankingRow[]; me: RankingRow | null }

type NotificationKind = 'TRAVEL_ARRIVED' | 'TRADE' | 'CLAN_INVITE' | 'MESSAGE' | 'COMBAT' | 'EVENT' | 'SYSTEM';
interface Notification { id: string; kind: NotificationKind; title: string; body?: string; link?: string; readAt: string | null; createdAt: string }

interface MoneyTransaction { id: string; amount: Money; balanceAfter: Money; reason: 'TRADE' | 'TRAVEL' | 'VEHICLE' | 'COMBAT' | 'CLAN' | 'BANK' | 'ADMIN'; createdAt: string }
interface TickerEvent { id: string; text: string; createdAt: string }
```

## Echtzeit

Vorerst **Polling** (TanStack Query): Spieler alle 15 s, Markt alle 30 s, Ticker und Benachrichtigungen alle 20 s.
Reise-Countdowns laufen lokal bis `arrivesAt`, danach lädt der Client Spieler und Reise neu.
Später kann ein SSE/WebSocket-Kanal `/api/v1/events` die Query-Caches invalidieren, ohne dass Komponenten geändert werden.

## Offene Punkte

1. **Clan-Ränge:** Backend `LEADER | OFFICER | MEMBER` ↔ Spielregeln (Agent 2) Pate / Consigliere / Capo / Soldat / Mitläufer.
   Das UI zeigt vorerst `LEADER → Pate`, `OFFICER → Capo`, `MEMBER → Soldat`. Bitte um Entscheidung.
2. **Schwarz-/Weißgeld (Agent 2)** vs. `cash`/`bank` (Agent 3). Das UI zeigt vorerst „Bargeld“ und „Bank“.
3. **Heat**, `techLevel`, `country`, `illegal`, `unitWeightG`, `capacityG`: Bitte ins Prisma-Schema aufnehmen.
4. Konkrete Städte, Waren und Fahrzeuge: Die Mocks nutzen Platzhalter, bis Agent 2 `parameters.toml` liefert.
