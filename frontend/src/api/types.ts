/**
 * UI-Modelle. Die Oberfläche arbeitet ausschließlich mit diesen Typen.
 * `api/adapters.ts` übersetzt die Rohformate des Backend-Vertrags (`api/contract.ts`)
 * hierher – ändert sich der Vertrag, ändert sich nur der Adapter.
 */
import type { ClanRoleDto, PlayerStatusDto, TransactionReasonDto } from './contract';

/** Geldbetrag in ganzzahligen Cent als String (ADR-019, BigInt-sicher). */
export type Money = string;
export type ISODate = string;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'PLAYER' | 'ADMIN';
  playerId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export type PlayerStatus = PlayerStatusDto;
export type ClanRole = ClanRoleDto;

export interface CityRef {
  id: string;
  slug: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  cash: Money;
  bank: Money;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  /** null, solange die Levelkurve nicht feststeht */
  experienceForNextLevel: number | null;
  reputation: number;
  heat: number;
  currentCityId: string | null;
  currentCity: CityRef | null;
  status: PlayerStatus;
  statusUntil: ISODate | null;
  clanId: string | null;
  clan: { id: string; name: string; tag: string; role: ClanRole } | null;
  createdAt: ISODate;
}

export interface City {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  country: string | null;
  techLevel: number | null;
  policeStrength: number | null;
  population: number | null;
}

export interface CityConnection {
  toCityId: string;
  toCity: CityRef;
  distanceKm: number;
  /** Fehlt, bis das Backend die Reiseregeln umsetzt */
  durationSeconds: number | null;
  cost: Money | null;
}

export interface CityDetail extends City {
  connections: CityConnection[];
}

export interface Commodity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  illegal: boolean;
  unitWeightG: number;
  basePrice: Money;
}

export type Trend = 'UP' | 'DOWN' | 'FLAT';

export interface MarketEntry {
  commodity: Commodity;
  buyPrice: Money;
  sellPrice: Money;
  supply: number;
  /** Vom Client aus dem letzten bekannten Preis abgeleitet */
  trend: Trend;
  updatedAt: ISODate;
}

export interface PricePoint {
  city: CityRef;
  price: Money;
  updatedAt: ISODate;
}

export interface OverviewRow {
  commodity: Commodity;
  lowestBuy: PricePoint | null;
  highestSell: PricePoint | null;
}

export interface InventoryItem {
  commodity: Commodity;
  quantity: number;
  avgBuyPrice: Money;
}

export interface Inventory {
  items: InventoryItem[];
  /** null = kein aktives Fahrzeug (Kapazität bestimmt der Server) */
  capacityG: number | null;
  usedG: number;
}

export type TradeSide = 'BUY' | 'SELL';

export interface TradeResult {
  player: Player;
  inventory: Inventory;
}

export interface VehicleType {
  id: string;
  slug: string;
  name: string;
  price: Money;
  capacityG: number;
  speedKmh: number;
  licenseClass: number | null;
}

export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  condition: number;
  isActive: boolean;
  purchasedAt: ISODate;
}

export interface EquipmentType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: 'WEAPON' | 'ARMOR';
  attack: number;
  defense: number;
  price: Money;
  weightG: number | null;
}

export interface PlayerEquipment {
  id: string;
  equipmentType: EquipmentType;
  equipped: boolean;
  acquiredAt: ISODate;
}

export interface Travel {
  id: string;
  fromCityId: string;
  toCityId: string;
  fromCity: CityRef;
  toCity: CityRef;
  vehicleName: string | null;
  departedAt: ISODate;
  arrivesAt: ISODate;
  status: 'IN_PROGRESS' | 'ARRIVED' | 'CANCELLED';
}

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  memberCount: number;
  createdAt: ISODate;
}

export interface ClanMember {
  playerId: string;
  name: string;
  role: ClanRole;
  level: number;
  reputation: number;
  joinedAt: ISODate;
}

export interface ClanDetail extends ClanSummary {
  /** Nur für Mitglieder sichtbar, sonst null */
  bank: Money | null;
  members: ClanMember[];
}

export interface ClanInvite {
  id: string;
  clan: { id: string; name: string; tag: string };
  invitedByName: string | null;
  createdAt: ISODate;
}

export type RankingType = 'wealth' | 'reputation' | 'level' | 'clans';

export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  tag: string | null;
  level: number | null;
  /** Bei wealth/clans: Cent, sonst Zahl – immer als String */
  value: string;
  isMe: boolean;
}

export interface Ranking {
  type: RankingType;
  total: number;
  rows: RankingRow[];
}

export type NotificationKind =
  | 'TRAVEL_ARRIVED'
  | 'TRADE'
  | 'CLAN_INVITE'
  | 'MESSAGE'
  | 'COMBAT'
  | 'EVENT'
  | 'SYSTEM';

export interface GameNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface NotificationList {
  items: GameNotification[];
  unreadCount: number;
  total: number;
}

export type TransactionReason = TransactionReasonDto;

export interface MoneyTransaction {
  id: string;
  amount: Money;
  balanceAfter: Money;
  reason: TransactionReason;
  createdAt: ISODate;
}

export interface TickerEvent {
  id: string;
  text: string;
  createdAt: ISODate;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}
