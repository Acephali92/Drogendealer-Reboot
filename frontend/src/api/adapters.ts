/**
 * Übersetzt Backend-Rohformate (contract.ts) in UI-Modelle (types.ts).
 * Einzige Stelle, die bei Vertragsänderungen angepasst werden muss.
 */
import type * as C from './contract';
import type * as UI from './types';

export const toPlayer = (p: C.PlayerDto): UI.Player => ({
  ...p,
  currentCityId: p.currentCity?.id ?? null,
});

export const toUser = (u: C.UserDto): UI.AuthUser => ({ ...u });

export const toAuth = (r: C.AuthResponseDto): UI.AuthResponse => ({
  accessToken: r.accessToken,
  refreshToken: r.refreshToken,
  user: toUser(r.user),
});

export const toCommodity = (c: C.CommodityDto): UI.Commodity => ({ ...c });

export const toCity = (c: C.CityDto): UI.City => ({ ...c });

export const toCityDetail = (c: C.CityDto & { connections: C.ConnectionDto[] }): UI.CityDetail => ({
  ...toCity(c),
  connections: c.connections.map((x) => ({
    toCityId: x.toCityId,
    toCity: x.toCity,
    distanceKm: x.distanceKm,
    durationSeconds: x.durationSeconds ?? null,
    cost: x.cost ?? null,
  })),
});

/* Trend: Vergleich mit dem zuletzt gesehenen Preis je Stadt und Ware (Backend liefert keinen Trend). */
const lastSeen = new Map<string, { price: bigint; trend: UI.Trend }>();

export function withTrend(cityId: string, commodityId: string, buyPrice: string): UI.Trend {
  const key = `${cityId}:${commodityId}`;
  const now = BigInt(buyPrice);
  const prev = lastSeen.get(key);
  let trend: UI.Trend = prev?.trend ?? 'FLAT';
  if (prev && now !== prev.price) trend = now > prev.price ? 'UP' : 'DOWN';
  lastSeen.set(key, { price: now, trend });
  return trend;
}

export const toMarket = (m: C.MarketDto): UI.MarketEntry[] =>
  m.prices.map((p) => ({
    commodity: toCommodity(p.commodity),
    buyPrice: p.buyPrice,
    sellPrice: p.sellPrice,
    supply: p.supply,
    updatedAt: p.updatedAt,
    trend: withTrend(m.city.id, p.commodity.id, p.buyPrice),
  }));

export const toOverview = (o: C.OverviewDto): UI.OverviewRow[] =>
  o.commodities.map((r) => ({ commodity: toCommodity(r.commodity), lowestBuy: r.lowestBuy, highestSell: r.highestSell }));

export const toInventory = (i: C.InventoryDto): UI.Inventory => ({
  items: i.items.map((x) => ({ ...x, commodity: toCommodity(x.commodity) })),
  capacityG: i.capacityG,
  usedG: i.usedG,
});

export const toVehicle = (v: C.VehicleDto): UI.Vehicle => ({ ...v });
export const toEquipment = (e: C.EquipmentDto): UI.PlayerEquipment => ({ ...e });

export const toTravel = (t: C.TravelDto | null): UI.Travel | null =>
  t && {
    id: t.id,
    status: t.status,
    departedAt: t.departedAt,
    arrivesAt: t.arrivesAt,
    fromCity: t.fromCity,
    toCity: t.toCity,
    fromCityId: t.fromCity.id,
    toCityId: t.toCity.id,
    vehicleName: t.vehicle?.vehicleType.name ?? null,
  };

export const toClanSummary = (c: C.ClanListItemDto): UI.ClanSummary => ({
  id: c.id,
  name: c.name,
  tag: c.tag,
  description: c.description,
  memberCount: c.memberCount,
  createdAt: c.createdAt,
});

export const toClanDetail = (c: C.ClanDetailDto): UI.ClanDetail => ({
  ...toClanSummary(c),
  bank: c.bank,
  members: c.members,
});

export const toInvite = (i: C.ClanInviteDto): UI.ClanInvite => ({
  id: i.id,
  clan: i.clan,
  invitedByName: i.invitedBy?.name ?? null,
  createdAt: i.createdAt,
});

export function toRanking(r: C.RankingDto, me: { playerId?: string | null; clanId?: string | null }): UI.Ranking {
  return {
    type: r.type,
    total: r.total,
    rows: r.entries.map((e) =>
      'player' in e
        ? {
            rank: e.rank,
            id: e.player.id,
            name: e.player.name,
            tag: e.player.clanTag,
            level: e.player.level,
            value: e.value,
            isMe: e.player.id === me.playerId,
          }
        : {
            rank: e.rank,
            id: e.clan.id,
            name: e.clan.name,
            tag: e.clan.tag,
            level: null,
            value: e.value,
            isMe: e.clan.id === me.clanId,
          },
    ),
  };
}

const KIND_RULES: [RegExp, UI.NotificationKind][] = [
  [/TRAVEL|ARRIV/i, 'TRAVEL_ARRIVED'],
  [/CLAN_INVITE|INVITE/i, 'CLAN_INVITE'],
  [/TRADE/i, 'TRADE'],
  [/MESSAGE/i, 'MESSAGE'],
  [/COMBAT|ATTACK/i, 'COMBAT'],
  [/EVENT|RAZZIA|PARTY/i, 'EVENT'],
];
const DEFAULT_LINK: Partial<Record<UI.NotificationKind, string>> = {
  TRAVEL_ARRIVED: '/handel',
  CLAN_INVITE: '/clans',
  TRADE: '/inventar',
};

export function toNotification(n: C.NotificationDto): UI.GameNotification {
  const kind = KIND_RULES.find(([re]) => re.test(n.type))?.[1] ?? 'SYSTEM';
  const link = typeof n.data?.link === 'string' && n.data.link.startsWith('/') ? n.data.link : DEFAULT_LINK[kind] ?? null;
  return { id: n.id, kind, title: n.title, body: n.body, link, readAt: n.readAt, createdAt: n.createdAt };
}

export const toTicker = (e: C.TickerEventDto): UI.TickerEvent => ({ id: e.id, text: e.message, createdAt: e.createdAt });

export const toTransaction = (t: C.MoneyTransactionDto): UI.MoneyTransaction => ({
  id: t.id,
  amount: t.amount,
  balanceAfter: t.balanceAfter,
  reason: t.reason,
  createdAt: t.createdAt,
});
