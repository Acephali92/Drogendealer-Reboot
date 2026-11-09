/** Ein Funktionsaufruf pro Endpunkt aus docs/frontend/API-CONTRACT.md. */
import { api, get, post } from './client';
import type {
  AuthResponse,
  City,
  CityDetail,
  ClanDetail,
  ClanInvite,
  ClanSummary,
  EquipmentType,
  GameNotification,
  Inventory,
  MarketEntry,
  MarketOverview,
  MoneyTransaction,
  Player,
  PlayerEquipment,
  Ranking,
  RankingType,
  TickerEvent,
  TradeResult,
  TradeSide,
  Travel,
  Vehicle,
  VehicleType,
} from './types';

export const authApi = {
  login: (login: string, password: string) =>
    api<AuthResponse>('POST', '/auth/login', { body: { login, password }, anonymous: true }),
  register: (email: string, username: string, password: string) =>
    api<AuthResponse>('POST', '/auth/register', { body: { email, username, password }, anonymous: true }),
  logout: (refreshToken: string) =>
    api<void>('POST', '/auth/logout', { body: { refreshToken }, anonymous: true }),
};

export const playerApi = {
  me: () => get<Player>('/players/me'),
  setStartCity: (cityId: string) => post<Player>('/players/me/start-city', { cityId }),
  transactions: () => get<MoneyTransaction[]>('/players/me/transactions?limit=50'),
  online: () => get<{ count: number }>('/players/online'),
};

export const worldApi = {
  cities: () => get<City[]>('/cities'),
  city: (slug: string) => get<CityDetail>(`/cities/${encodeURIComponent(slug)}`),
  market: (slug: string) => get<MarketEntry[]>(`/cities/${encodeURIComponent(slug)}/market`),
  overview: () => get<MarketOverview>('/market/overview'),
  ticker: () => get<TickerEvent[]>('/ticker'),
};

export const tradeApi = {
  trade: (b: { cityId: string; commodityId: string; side: TradeSide; quantity: number }) =>
    post<TradeResult>('/trade', b),
  inventory: () => get<Inventory>('/inventory'),
};

export const vehicleApi = {
  types: () => get<VehicleType[]>('/vehicle-types'),
  mine: () => get<Vehicle[]>('/vehicles'),
  buy: (vehicleTypeId: string) => post<{ vehicle: Vehicle; player: Player }>('/vehicles', { vehicleTypeId }),
  activate: (id: string) => post<Vehicle[]>(`/vehicles/${id}/activate`),
  sell: (id: string) => post<{ player: Player }>(`/vehicles/${id}/sell`),
};

export const equipmentApi = {
  types: () => get<EquipmentType[]>('/equipment-types'),
  mine: () => get<PlayerEquipment[]>('/equipment'),
  buy: (equipmentTypeId: string) =>
    post<{ equipment: PlayerEquipment; player: Player }>('/equipment', { equipmentTypeId }),
};

export const travelApi = {
  start: (toCityId: string) => post<Travel>('/travel', { toCityId }),
  current: () => get<Travel | null>('/travel/current'),
};

export const clanApi = {
  list: () => get<ClanSummary[]>('/clans'),
  get: (id: string) => get<ClanDetail>(`/clans/${id}`),
  create: (b: { name: string; tag: string; description?: string }) => post<ClanDetail>('/clans', b),
  invite: (id: string, playerName: string) => post<ClanInvite>(`/clans/${id}/invites`, { playerName }),
  leave: (id: string) => post<void>(`/clans/${id}/leave`),
  invites: () => get<ClanInvite[]>('/clan-invites'),
  accept: (id: string) => post<ClanDetail>(`/clan-invites/${id}/accept`),
  decline: (id: string) => post<void>(`/clan-invites/${id}/decline`),
};

export const rankingApi = {
  get: (type: RankingType) => get<Ranking>(`/rankings?type=${type}&limit=50`),
};

export const notificationApi = {
  list: () => get<GameNotification[]>('/notifications'),
  read: (id: string) => post<void>(`/notifications/${id}/read`),
  readAll: () => post<void>('/notifications/read-all'),
};
