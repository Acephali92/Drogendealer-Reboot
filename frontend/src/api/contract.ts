/**
 * Rohformate des Backend-Vertrags `docs/api/API-CONTRACT.md` (ADR-011, Owner: Agent 3).
 * Nur `api/adapters.ts` und die Mocks verwenden diese Typen direkt; die Oberfläche
 * arbeitet mit den UI-Modellen aus `api/types.ts`.
 *
 * Abschnitt „Noch nicht implementiert“: Formate stammen aus dem Anforderungsdokument
 * `docs/frontend/API-CONTRACT.md` und sind mit (draft) markiert.
 */

/** Ganzzahlige Cent als String (ADR-019). */
export type Cents = string;
export type ISO = string;

export type ClanRoleDto = 'GODFATHER' | 'CONSIGLIERE' | 'CAPO' | 'SOLDIER' | 'ASSOCIATE';
export type PlayerStatusDto = 'IDLE' | 'TRAVELING' | 'IN_COMBAT' | 'HOSPITAL' | 'JAIL';
export type TransactionReasonDto =
  | 'TRADE'
  | 'TRAVEL'
  | 'VEHICLE'
  | 'EQUIPMENT'
  | 'COMBAT'
  | 'CLAN'
  | 'BANK'
  | 'ADMIN';

export interface Page {
  total: number;
  limit: number;
  offset: number;
}

/* Auth */
export interface UserDto {
  id: string;
  email: string;
  username: string;
  role: 'PLAYER' | 'ADMIN';
  playerId: string;
}
export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

/* Spieler */
export interface CityRefDto {
  id: string;
  slug: string;
  name: string;
}
export interface PlayerDto {
  id: string;
  name: string;
  cash: Cents;
  bank: Cents;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  experienceForNextLevel: number | null;
  reputation: number;
  heat: number;
  status: PlayerStatusDto;
  statusUntil: ISO | null;
  createdAt: ISO;
  currentCity: CityRefDto | null;
  clanId: string | null;
  clan: { id: string; name: string; tag: string; role: ClanRoleDto } | null;
}
export interface MoneyTransactionDto {
  id: string;
  amount: Cents;
  balanceAfter: Cents;
  reason: TransactionReasonDto;
  refId: string | null;
  createdAt: ISO;
}
export interface OnlineDto {
  count: number;
  players: { id: string; name: string; level: number; clanTag: string | null }[];
}

/* Welt & Markt */
export interface CityDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  country: string | null;
  techLevel: number | null;
  policeStrength: number | null;
  population: number | null;
}
export interface ConnectionDto {
  toCityId: string;
  toCity: CityRefDto;
  distanceKm: number;
  /** (draft) – fehlt im Backend, bis Reiseregeln umgesetzt sind */
  durationSeconds?: number | null;
  /** (draft) */
  cost?: Cents | null;
}
export interface CommodityDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  illegal: boolean;
  unitWeightG: number;
  basePrice: Cents;
}
export interface MarketPriceDto {
  commodity: CommodityDto;
  buyPrice: Cents;
  sellPrice: Cents;
  supply: number;
  updatedAt: ISO;
}
export interface MarketDto {
  city: CityRefDto;
  prices: MarketPriceDto[];
}
export interface PricePointDto {
  city: CityRefDto;
  price: Cents;
  updatedAt: ISO;
}
export interface OverviewDto {
  commodities: {
    commodity: CommodityDto;
    lowestBuy: PricePointDto | null;
    highestSell: PricePointDto | null;
  }[];
}

/* Besitz */
export interface InventoryDto {
  items: { commodity: CommodityDto; quantity: number; avgBuyPrice: Cents }[];
  capacityG: number | null;
  usedG: number;
}
export interface VehicleTypeDto {
  id: string;
  slug: string;
  name: string;
  price: Cents;
  capacityG: number;
  speedKmh: number;
  licenseClass: number | null;
}
export interface VehicleDto {
  id: string;
  condition: number;
  isActive: boolean;
  purchasedAt: ISO;
  vehicleType: VehicleTypeDto;
}
export interface EquipmentTypeDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: 'WEAPON' | 'ARMOR';
  attack: number;
  defense: number;
  weightG: number | null;
  price: Cents;
}
export interface EquipmentDto {
  id: string;
  equipped: boolean;
  acquiredAt: ISO;
  equipmentType: EquipmentTypeDto;
}
export interface TravelDto {
  id: string;
  status: 'IN_PROGRESS' | 'ARRIVED' | 'CANCELLED';
  departedAt: ISO;
  arrivesAt: ISO;
  fromCity: CityRefDto;
  toCity: CityRefDto;
  vehicle: { id: string; vehicleType: { slug: string; name: string } } | null;
}

/* Clans & Soziales */
export interface ClanListItemDto {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  createdAt: ISO;
  memberCount: number;
}
export interface ClanMemberDto {
  playerId: string;
  name: string;
  level: number;
  reputation: number;
  role: ClanRoleDto;
  joinedAt: ISO;
}
export interface ClanDetailDto extends ClanListItemDto {
  bank: Cents | null;
  members: ClanMemberDto[];
}
export interface ClanInviteDto {
  id: string;
  createdAt: ISO;
  clan: { id: string; name: string; tag: string };
  invitedBy: { id: string; name: string } | null;
}
export type RankingTypeDto = 'wealth' | 'reputation' | 'level' | 'clans';
export type RankingEntryDto =
  | {
      rank: number;
      player: { id: string; name: string; level: number; clanTag: string | null };
      value: string;
    }
  | { rank: number; clan: { id: string; name: string; tag: string; memberCount: number }; value: string };
export interface RankingDto extends Page {
  type: RankingTypeDto;
  entries: RankingEntryDto[];
}
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: ISO | null;
  createdAt: ISO;
}
export interface TickerEventDto {
  id: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: ISO;
}

/* (draft) Schreibende Endpunkte – Antworten */
export interface TradeResultDto {
  player: PlayerDto;
  inventory: InventoryDto;
  transaction: {
    id: string;
    cityId: string;
    commodityId: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    unitPrice: Cents;
    total: Cents;
    createdAt: ISO;
  };
}
