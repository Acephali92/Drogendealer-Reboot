/**
 * Übersetzt Backend-Rohformate (contract.ts) in UI-Modelle (types.ts).
 * Einzige Stelle, die bei Vertragsänderungen angepasst werden muss.
 */
import i18n from '@/i18n';
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

export const toCommodity = (c: C.CommodityDto): UI.Commodity => ({ ...c, image: c.image ?? null });
export const toVehicleType = (v: C.VehicleTypeDto): UI.VehicleType => ({ ...v, image: v.image ?? null });

/** Fehlt der Name in parameters.toml (T-117), neutraler Name je Slot – nie der Schlüssel (T-112). */
export const toEquipmentType = (e: C.EquipmentTypeDto): UI.EquipmentType => ({
  ...e,
  name: e.name?.trim() || i18n.t(e.slot === 'WEAPON' ? 'weapons.unnamedWeapon' : 'weapons.unnamedArmor'),
  image: e.image ?? null,
});

export const toCity = (c: C.CityDto): UI.City => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  realm: c.realm,
  population: Math.round(c.pop * 1000),
  wealth: c.wealth,
  police: c.police,
  fuelPrice: c.fuelPrice,
  spaceport: c.spaceport,
});

export const toCityDetail = (c: C.CityDto & { connections: C.ConnectionDto[] }): UI.CityDetail => ({
  ...toCity(c),
  connections: c.connections.map((x) => ({
    toCityId: x.toCityId,
    toCity: x.toCity,
    distanceKm: x.distanceKm,
    travelOptions: (x.travelOptions ?? []).map((o) => ({
      mode: o.mode,
      vehicleId: o.vehicleId ?? null,
      durationSeconds: o.durationSeconds,
      cost: o.cost,
    })),
  })),
});

/* Trend: Vergleich mit dem zuletzt gesehenen Preis je Stadt und Ware (Backend liefert keinen Trend). */
const lastSeen = new Map<string, { price: bigint; trend: UI.Trend }>();

export function withTrend(cityId: string, commodityId: string, price: string): UI.Trend {
  const key = `${cityId}:${commodityId}`;
  const now = BigInt(price);
  const prev = lastSeen.get(key);
  let trend: UI.Trend = prev?.trend ?? 'FLAT';
  if (prev && now !== prev.price) trend = now > prev.price ? 'UP' : 'DOWN';
  lastSeen.set(key, { price: now, trend });
  return trend;
}

export const toMarket = (m: C.MarketDto): UI.MarketEntry[] =>
  m.markets.map((r) => ({
    commodity: toCommodity(r.commodity),
    stock: Math.floor(r.stock),
    referencePrice: r.referencePrice,
    activeEvent: r.activeEvent,
    eventTicksLeft: r.eventTicksLeft,
    updatedAt: r.updatedAt,
    trend: withTrend(m.city.id, r.commodity.id, r.referencePrice),
  }));

export const toOverview = (o: C.OverviewDto): UI.OverviewRow[] =>
  o.commodities.map((r) => ({
    commodity: toCommodity(r.commodity),
    lowestPrice: r.lowestPrice,
    highestPrice: r.highestPrice,
  }));

export const toInventory = (i: C.InventoryDto): UI.Inventory => ({
  items: i.items.map((x) => ({ ...x, commodity: toCommodity(x.commodity) })),
  capacity: i.capacity,
  used: i.used,
});

export const toVehicle = (v: C.VehicleDto): UI.Vehicle => ({
  ...v,
  vehicleType: toVehicleType(v.vehicleType),
});
export const toEquipment = (e: C.EquipmentDto): UI.PlayerEquipment => ({
  ...e,
  equipmentType: toEquipmentType(e.equipmentType),
});

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
  treasury: c.treasury,
  members: c.members,
});

export const toInvite = (i: C.ClanInviteDto): UI.ClanInvite => ({
  id: i.id,
  clan: i.clan,
  invitedByName: i.invitedBy?.name ?? null,
  createdAt: i.createdAt,
});

export function toRanking(
  r: C.RankingDto,
  me: { playerId?: string | null; clanId?: string | null },
): UI.Ranking {
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
  const link =
    typeof n.data?.link === 'string' && n.data.link.startsWith('/')
      ? n.data.link
      : (DEFAULT_LINK[kind] ?? null);
  return { id: n.id, kind, title: n.title, body: n.body, link, readAt: n.readAt, createdAt: n.createdAt };
}

export const toTicker = (e: C.TickerEventDto): UI.TickerEvent => ({
  id: e.id,
  text: e.message,
  createdAt: e.createdAt,
});

export const toTransaction = (t: C.MoneyTransactionDto): UI.MoneyTransaction => ({
  id: t.id,
  account: t.account,
  amount: t.amount,
  balanceAfter: t.balanceAfter,
  reason: t.reason,
  createdAt: t.createdAt,
});
