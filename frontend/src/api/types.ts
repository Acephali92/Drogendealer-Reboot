/**
 * UI-Modelle. Die Oberfläche arbeitet ausschließlich mit diesen Typen.
 * `api/adapters.ts` übersetzt die Rohformate des Backend-Vertrags (`api/contract.ts`)
 * hierher – ändert sich der Vertrag, ändert sich nur der Adapter.
 */
import type { AccountDto, ClanRoleDto, PlayerStatusDto, Realm, TransactionReasonDto } from './contract';

/** Geldbetrag in ganzzahligen Cent als String (ADR-019, BigInt-sicher). */
export type Money = string;
export type ISODate = string;
export type { Realm };

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
  /** Bargeld = Schwarzgeld, mitgeführt (ADR-023) */
  cash: Money;
  /** Bankkonto = Weißgeld (ADR-023) */
  bank: Money;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  /** null, solange die Levelkurve nicht feststeht */
  experienceForNextLevel: number | null;
  reputation: number;
  /** Fahndungsdruck in der aktuellen Stadt (0–100) */
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
  realm: Realm;
  /** Einwohner (absolut, aus „Tausend“ umgerechnet) */
  population: number;
  wealth: number;
  /** Polizeistärke 0–1 */
  police: number;
  /** Spritpreis in Cent pro Liter */
  fuelPrice: Money;
  spaceport: boolean;
}

export type TravelMode = 'train' | 'vehicle';

export interface TravelOption {
  mode: TravelMode;
  vehicleId: string | null;
  durationSeconds: number;
  cost: Money;
}

export interface CityConnection {
  toCityId: string;
  toCity: CityRef;
  distanceKm: number;
  /** Leer, bis das Backend die Reiseregeln umsetzt (T-119) */
  travelOptions: TravelOption[];
}

export interface CityDetail extends City {
  connections: CityConnection[];
}

export interface Commodity {
  id: string;
  slug: string;
  name: string;
  realm: Realm;
  basePrice: Money;
  /** Volumeneinheiten (VE) je Einheit */
  unitVolume: number;
  /** Bildpfad relativ zu images/ oder null (ADR-020) */
  image: string | null;
}

export type Trend = 'UP' | 'DOWN' | 'FLAT';

export interface MarketEntry {
  commodity: Commodity;
  /** Marktbestand (ganzzahlig gerundet für die Anzeige) */
  stock: number;
  /** Richtpreis (Gleichgewichtspreis) in Cent – echte Kauf-/Verkaufspreise je Menge folgen mit T-103 */
  referencePrice: Money;
  activeEvent: string | null;
  eventTicksLeft: number | null;
  /** Vom Client aus dem letzten bekannten Richtpreis abgeleitet */
  trend: Trend;
  updatedAt: ISODate;
}

export interface PricePoint {
  city: CityRef;
  referencePrice: Money;
}

export interface OverviewRow {
  commodity: Commodity;
  lowestPrice: PricePoint | null;
  highestPrice: PricePoint | null;
}

export interface InventoryItem {
  commodity: Commodity;
  quantity: number;
  avgBuyPrice: Money;
}

export interface Inventory {
  items: InventoryItem[];
  /** Volumeneinheiten: Rucksack + aktives Fahrzeug */
  capacity: number;
  used: number;
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
  speedKmh: number;
  consumptionPer100Km: number;
  /** Volumeneinheiten */
  capacity: number;
  /** Versteckbonus gegen Kontrollen (0–1) */
  hide: number;
  image: string | null;
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
  slot: 'WEAPON' | 'ARMOR';
  /** Anzeigename; fehlt er in den Parametern, setzt der Adapter einen neutralen Namen je Slot */
  name: string;
  strength: number;
  price: Money;
  image: string | null;
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
  /** Clan-Kasse (ADR-018), nur für Mitglieder sichtbar, sonst null */
  treasury: { cash: Money; bank: Money } | null;
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
export type Account = AccountDto;

export interface MoneyTransaction {
  id: string;
  account: Account;
  amount: Money;
  /** Saldo des jeweiligen Kontos nach der Buchung */
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
