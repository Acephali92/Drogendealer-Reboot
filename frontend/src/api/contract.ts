/**
 * Rohformate des Backend-Vertrags `docs/api/API-CONTRACT.md` (ADR-011, Owner: Agent 3),
 * Stand „Datenmodell v2“ (Breaking Changes, ADR-011 Nachtrag, PR #33).
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
export type Realm = 'earth' | 'space';
export type AccountDto = 'CASH' | 'BANK';
export type TransactionReasonDto =
  | 'START_CAPITAL'
  | 'TRADE_BUY'
  | 'TRADE_SELL'
  | 'TRAVEL_FUEL'
  | 'TRAVEL_TICKET'
  | 'BRIBE'
  | 'CONFISCATION'
  | 'VEHICLE_BUY'
  | 'VEHICLE_SALE'
  | 'EQUIPMENT_BUY'
  | 'EQUIPMENT_SALE'
  | 'CREW'
  | 'LOOT_GAINED'
  | 'LOOT_LOST'
  | 'LAUNDERING'
  | 'BUSINESS_INCOME'
  | 'BUSINESS_UPKEEP'
  | 'CLAN_DEPOSIT'
  | 'CLAN_PAYOUT'
  | 'CLAN_TAX'
  | 'EMERGENCY_LOAN'
  | 'LOAN_REPAYMENT'
  | 'ACCOUNT_DELETION'
  | 'ADMIN';

export interface Page {
  total: number;
  limit: number;
  offset: number;
}

/* Auth & System */
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
export interface ImagesDto {
  fallback: Record<'goods' | 'vehicles' | 'weapons' | 'armor' | 'crew' | 'ships', string | null>;
  allowedExtensions: string[];
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
  /** Bargeld (Schwarzgeld, mitgeführt) – ADR-023 */
  cash: Cents;
  /** Bankkonto (gewaschen) – ADR-023 */
  bank: Cents;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  experienceForNextLevel: number | null;
  reputation: number;
  /** Fahndungsdruck in der aktuellen Stadt (Float 0–100) */
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
  account: AccountDto;
  amount: Cents;
  /** Saldo dieses Kontos nach der Buchung */
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
  realm: Realm;
  /** Einwohner in Tausend */
  pop: number;
  wealth: number;
  /** Polizeistärke 0–1 */
  police: number;
  /** ct pro Liter */
  fuelPrice: Cents;
  spaceport: boolean;
}
/** (draft, T-119) Reiseoption je Verkehrsmittel – Vorschlag Agent 3 */
export interface TravelOptionDto {
  mode: 'train' | 'vehicle';
  vehicleId?: string;
  durationSeconds: number;
  cost: Cents;
}
export interface ConnectionDto {
  toCityId: string;
  toCity: CityRefDto;
  distanceKm: number;
  /** (draft, T-119) */
  travelOptions?: TravelOptionDto[];
}
export interface CommodityDto {
  id: string;
  slug: string;
  name: string;
  realm: Realm;
  basePrice: Cents;
  /** Volumeneinheiten je Einheit */
  unitVolume: number;
  /** Bildpfad relativ zu images/ (ADR-020) */
  image: string | null;
}
export interface MarketRowDto {
  commodity: CommodityDto;
  /** Marktbestand (Kommazahl) */
  stock: number;
  /** Gleichgewichtspreis P* (F-ECO-07) in Cent – nur Anzeige */
  referencePrice: Cents;
  activeEvent: string | null;
  eventTicksLeft: number | null;
  updatedAt: ISO;
}
export interface MarketDto {
  city: CityRefDto;
  markets: MarketRowDto[];
}
export interface PricePointDto {
  city: CityRefDto;
  referencePrice: Cents;
}
export interface OverviewDto {
  commodities: {
    commodity: CommodityDto;
    lowestPrice: PricePointDto | null;
    highestPrice: PricePointDto | null;
  }[];
}

/* Besitz */
export interface InventoryDto {
  items: { commodity: CommodityDto; quantity: number; avgBuyPrice: Cents }[];
  /** Volumeneinheiten: Rucksack + aktives Fahrzeug (nie null) */
  capacity: number;
  used: number;
}
export interface VehicleTypeDto {
  id: string;
  slug: string;
  name: string;
  price: Cents;
  speedKmh: number;
  consumptionPer100Km: number;
  /** Volumeneinheiten */
  capacity: number;
  /** Versteckbonus gegen Kontrollen (0–1) */
  hide: number;
  image: string | null;
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
  slot: 'WEAPON' | 'ARMOR';
  /** null, solange der Eintrag in parameters.toml keinen Namen hat */
  name: string | null;
  strength: number;
  price: Cents;
  image: string | null;
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
  /** Clan-Kasse (ADR-018), nur für Mitglieder, sonst null */
  treasury: { cash: Cents; bank: Cents } | null;
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
