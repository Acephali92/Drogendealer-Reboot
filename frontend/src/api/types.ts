/**
 * API-Typen. Maßgeblich abgestimmt in docs/frontend/API-CONTRACT.md.
 * Feldnamen folgen dem Prisma-Modell des Backends (Agent 3).
 */

/** Geldbetrag in Cent als Ganzzahl-String (BigInt-sicher). */
export type Money = string;
export type ISODate = string;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'PLAYER' | 'ADMIN';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export type PlayerStatus = 'IDLE' | 'TRAVELING' | 'IN_COMBAT' | 'HOSPITAL' | 'JAIL';

export interface Player {
  id: string;
  name: string;
  cash: Money;
  bank: Money;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  experienceForNextLevel: number;
  reputation: number;
  heat: number;
  currentCityId: string | null;
  status: PlayerStatus;
  statusUntil: ISODate | null;
  clanId: string | null;
  createdAt: ISODate;
}

export interface City {
  id: string;
  slug: string;
  name: string;
  country: string;
  description?: string;
  techLevel: number;
  policeStrength: number;
  population: number;
}

export interface CityConnection {
  toCityId: string;
  distanceKm: number;
  durationSeconds: number;
  cost: Money;
}

export interface CityDetail extends City {
  connections: CityConnection[];
}

export interface Commodity {
  id: string;
  slug: string;
  name: string;
  description?: string;
  illegal: boolean;
  unitWeightG: number;
  basePrice: Money;
  minPrice: Money;
  maxPrice: Money;
}

export type Trend = 'UP' | 'DOWN' | 'FLAT';

export interface MarketEntry {
  commodity: Commodity;
  buyPrice: Money;
  sellPrice: Money;
  supply: number;
  trend: Trend;
  updatedAt: ISODate;
}

export interface MarketOverview {
  cities: City[];
  commodities: Commodity[];
  prices: Record<string, Record<string, { buyPrice: Money; sellPrice: Money; trend: Trend }>>;
}

export interface InventoryItem {
  commodity: Commodity;
  quantity: number;
  avgBuyPrice: Money;
}

export interface Inventory {
  items: InventoryItem[];
  capacityG: number;
  usedG: number;
}

export type TradeSide = 'BUY' | 'SELL';

export interface TradeTransaction {
  id: string;
  cityId: string;
  commodityId: string;
  side: TradeSide;
  quantity: number;
  unitPrice: Money;
  total: Money;
  createdAt: ISODate;
}

export interface TradeResult {
  player: Player;
  inventory: Inventory;
  transaction: TradeTransaction;
}

export interface VehicleType {
  id: string;
  slug: string;
  name: string;
  price: Money;
  capacityG: number;
  speedKmh: number;
  licenseClass: number;
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
  description?: string;
  slot: 'WEAPON' | 'ARMOR';
  attack: number;
  defense: number;
  price: Money;
  weightG: number;
}

export interface PlayerEquipment {
  id: string;
  equipmentType: EquipmentType;
  equipped: boolean;
}

export interface Travel {
  id: string;
  fromCityId: string;
  toCityId: string;
  vehicleId: string | null;
  departedAt: ISODate;
  arrivesAt: ISODate;
  status: 'IN_PROGRESS' | 'ARRIVED' | 'CANCELLED';
}

export type ClanRole = 'LEADER' | 'OFFICER' | 'MEMBER';

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  wealth: Money;
  leaderName: string;
}

export interface ClanMember {
  playerId: string;
  name: string;
  role: ClanRole;
  level: number;
  joinedAt: ISODate;
}

export interface ClanDetail extends ClanSummary {
  description?: string;
  bank: Money;
  members: ClanMember[];
  createdAt: ISODate;
}

export interface ClanInvite {
  id: string;
  clan: ClanSummary;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: ISODate;
}

export type RankingType = 'wealth' | 'reputation' | 'level' | 'clans';

export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  tag?: string;
  /** Bei wealth/clans: Money, sonst Zahl als String. */
  value: string;
  isMe: boolean;
}

export interface Ranking {
  type: RankingType;
  rows: RankingRow[];
  me: RankingRow | null;
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
  body?: string;
  link?: string;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export type TransactionReason = 'TRADE' | 'TRAVEL' | 'VEHICLE' | 'COMBAT' | 'CLAN' | 'BANK' | 'ADMIN';

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
  error: { code: string; message: string };
}
