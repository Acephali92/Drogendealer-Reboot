/**
 * Ein Funktionsaufruf pro Endpunkt aus docs/api/API-CONTRACT.md.
 * Antworten werden über api/adapters.ts in UI-Modelle übersetzt.
 * Mit (draft) markierte Endpunkte sind im Backend noch nicht implementiert und laufen über den Mock.
 */
import { api, del, download, get, post } from './client';
import type * as C from './contract';
import * as A from './adapters';
import type { RankingType, TradeSide } from './types';

export const authApi = {
  login: async (login: string, password: string) =>
    A.toAuth(await api<C.AuthResponseDto>('POST', '/auth/login', { body: { login, password }, anonymous: true })),
  register: async (email: string, username: string, password: string, ageConfirmed: boolean) =>
    A.toAuth(
      await api<C.AuthResponseDto>('POST', '/auth/register', {
        body: { email, username, password, ageConfirmed },
        anonymous: true,
      }),
    ),
  logout: (refreshToken: string) => api<void>('POST', '/auth/logout', { body: { refreshToken }, anonymous: true }),
};

export const playerApi = {
  me: async () => A.toPlayer((await get<{ player: C.PlayerDto }>('/players/me')).player),
  /** (draft) */
  setStartCity: async (cityId: string) =>
    A.toPlayer((await post<{ player: C.PlayerDto }>('/players/me/start-city', { cityId })).player),
  transactions: async () =>
    (await get<{ items: C.MoneyTransactionDto[] } & C.Page>('/players/me/transactions?limit=50')).items.map(
      A.toTransaction,
    ),
  online: () => get<C.OnlineDto>('/players/online'),
  exportData: () => download('/players/me/export'),
  deleteAccount: (password: string) => del<void>('/players/me', { password }),
};

export const worldApi = {
  cities: async () => (await get<{ cities: C.CityDto[] }>('/cities')).cities.map(A.toCity),
  city: async (slug: string) =>
    A.toCityDetail((await get<{ city: C.CityDto & { connections: C.ConnectionDto[] } }>(`/cities/${encodeURIComponent(slug)}`)).city),
  market: async (slug: string) => A.toMarket(await get<C.MarketDto>(`/cities/${encodeURIComponent(slug)}/market`)),
  overview: async () => A.toOverview(await get<C.OverviewDto>('/market/overview')),
  ticker: async () => (await get<{ events: C.TickerEventDto[] }>('/ticker?limit=30')).events.map(A.toTicker),
};

export const tradeApi = {
  /** (draft) */
  trade: async (b: { cityId: string; commodityId: string; side: TradeSide; quantity: number }) => {
    const r = await post<C.TradeResultDto>('/trade', b);
    return { player: A.toPlayer(r.player), inventory: A.toInventory(r.inventory) };
  },
  inventory: async () => A.toInventory(await get<C.InventoryDto>('/inventory')),
};

export const vehicleApi = {
  types: async () => (await get<{ vehicleTypes: C.VehicleTypeDto[] }>('/vehicle-types')).vehicleTypes,
  mine: async () => (await get<{ vehicles: C.VehicleDto[] }>('/vehicles')).vehicles.map(A.toVehicle),
  /** (draft) */
  buy: async (vehicleTypeId: string) =>
    A.toPlayer((await post<{ vehicle: C.VehicleDto; player: C.PlayerDto }>('/vehicles', { vehicleTypeId })).player),
  /** (draft) */
  activate: async (id: string) =>
    (await post<{ vehicles: C.VehicleDto[] }>(`/vehicles/${id}/activate`)).vehicles.map(A.toVehicle),
  /** (draft) */
  sell: async (id: string) => A.toPlayer((await post<{ player: C.PlayerDto }>(`/vehicles/${id}/sell`)).player),
};

export const equipmentApi = {
  types: async () => (await get<{ equipmentTypes: C.EquipmentTypeDto[] }>('/equipment-types')).equipmentTypes,
  mine: async () => (await get<{ equipment: C.EquipmentDto[] }>('/equipment')).equipment.map(A.toEquipment),
  /** (draft) */
  buy: async (equipmentTypeId: string) =>
    A.toPlayer((await post<{ equipment: C.EquipmentDto; player: C.PlayerDto }>('/equipment', { equipmentTypeId })).player),
};

export const travelApi = {
  /** (draft) */
  start: async (toCityId: string) => A.toTravel((await post<{ travel: C.TravelDto }>('/travel', { toCityId })).travel)!,
  current: async () => A.toTravel((await get<{ travel: C.TravelDto | null }>('/travel/current')).travel),
};

export const clanApi = {
  list: async () => (await get<{ clans: C.ClanListItemDto[] } & C.Page>('/clans?limit=100')).clans.map(A.toClanSummary),
  get: async (id: string) => A.toClanDetail((await get<{ clan: C.ClanDetailDto }>(`/clans/${id}`)).clan),
  /** (draft) */
  create: async (b: { name: string; tag: string; description?: string }) =>
    A.toClanDetail((await post<{ clan: C.ClanDetailDto }>('/clans', b)).clan),
  /** (draft) */
  invite: (id: string, playerName: string) => post<unknown>(`/clans/${id}/invites`, { playerName }),
  /** (draft) */
  leave: (id: string) => post<void>(`/clans/${id}/leave`),
  invites: async () => (await get<{ invites: C.ClanInviteDto[] }>('/clan-invites')).invites.map(A.toInvite),
  /** (draft) */
  accept: async (id: string) => A.toClanDetail((await post<{ clan: C.ClanDetailDto }>(`/clan-invites/${id}/accept`)).clan),
  /** (draft) */
  decline: (id: string) => post<void>(`/clan-invites/${id}/decline`),
};

export const rankingApi = {
  get: async (type: RankingType, me: { playerId?: string | null; clanId?: string | null }) =>
    A.toRanking(await get<C.RankingDto>(`/rankings?type=${type}&limit=50`), me),
};

export const notificationApi = {
  list: async () => {
    const r = await get<{ items: C.NotificationDto[]; unreadCount: number } & C.Page>('/notifications?limit=50');
    return { items: r.items.map(A.toNotification), unreadCount: r.unreadCount, total: r.total };
  },
  read: (id: string) => post<unknown>(`/notifications/${id}/read`),
  readAll: () => post<{ updated: number }>('/notifications/read-all'),
};
