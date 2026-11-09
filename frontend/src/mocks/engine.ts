/**
 * Mock-Spielserver für Entwicklung und Demo. Antwortet exakt im Format von
 * docs/api/API-CONTRACT.md (Rohformate in api/contract.ts); noch nicht implementierte,
 * schreibende Endpunkte folgen dem Entwurf in docs/frontend/API-CONTRACT.md.
 *
 * Das ist KEINE Spiellogik-Referenz – die Regeln definiert Agent 2, die verbindliche
 * Umsetzung Agent 3. Geld intern als Zahl in Cent (sicher bis ~9e15), an der Grenze als String.
 */
import type * as C from '@/api/contract';
import {
  BOT_CLANS,
  BOT_NAMES,
  CITIES,
  CLAN_FOUNDING_COST,
  COMMODITIES,
  DISTANCES,
  EQUIPMENT,
  MOCK_TICK_MS,
  START,
  TRAIN,
  TRAVEL_TIME_SCALE,
  VEHICLE_RESALE_RATE,
  VEHICLES,
  VOLUME_G,
} from './data';

export class MockApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new MockApiError(status, code, message);
};

/* ------------------------------------------------------------------ Zustand */

interface PriceRow {
  mid: number;
  supply: number;
  updatedAt: number;
}

interface PlayerRow {
  id: string;
  name: string;
  isBot: boolean;
  cash: number;
  bank: number;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  reputation: number;
  heat: number;
  currentCityId: string | null;
  status: C.PlayerStatusDto;
  statusUntil: number | null;
  createdAt: number;
  inventory: Record<string, { q: number; avgBuy: number }>;
  vehicles: { id: string; typeId: string; condition: number; isActive: boolean; purchasedAt: number }[];
  equipment: { id: string; typeId: string; equipped: boolean; acquiredAt: number }[];
  travel: { id: string; from: string; to: string; vehicleId: string | null; dep: number; arr: number } | null;
  notifications: C.NotificationDto[];
  transactions: C.MoneyTransactionDto[];
  botWealth?: number;
}

interface ClanRow {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  bank: number;
  createdAt: number;
  members: { playerId: string; role: C.ClanRoleDto; joinedAt: number }[];
}

interface InviteRow {
  id: string;
  clanId: string;
  playerId: string;
  invitedById: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  password: string;
  playerId: string;
  createdAt: number;
  ageConfirmedAt: number;
}

export interface MockState {
  version: 2;
  rng: number;
  lastTick: number;
  idSeq: number;
  prices: Record<string, Record<string, PriceRow>>;
  users: UserRow[];
  tokens: Record<string, string>;
  players: Record<string, PlayerRow>;
  clans: ClanRow[];
  invites: InviteRow[];
  ticker: C.TickerEventDto[];
}

/* -------------------------------------------------------------- Stammdaten */

const cityId = (slug: string) => `city_${slug}`;
const comId = (slug: string) => `com_${slug}`;

export const cities: C.CityDto[] = CITIES.map((c) => ({
  id: cityId(c.slug),
  slug: c.slug,
  name: c.name,
  description: c.description,
  country: c.country,
  techLevel: null,
  policeStrength: Math.round(c.police * 100),
  population: c.pop * 1000,
}));

export const commodities: C.CommodityDto[] = COMMODITIES.map((c) => ({
  id: comId(c.slug),
  slug: c.slug,
  name: c.name,
  description: c.description,
  illegal: true,
  unitWeightG: c.volume * VOLUME_G,
  basePrice: String(c.basePrice),
}));

export const vehicleTypes: C.VehicleTypeDto[] = VEHICLES.map((v) => ({
  id: `vt_${v.slug}`,
  slug: v.slug,
  name: v.name,
  price: String(v.price),
  capacityG: v.capacity * VOLUME_G,
  speedKmh: v.speedKmh,
  licenseClass: null,
}));

export const equipmentTypes: C.EquipmentTypeDto[] = EQUIPMENT.map((e) => ({
  id: `eq_${e.slug}`,
  slug: e.slug,
  name: e.name,
  description: e.description,
  slot: e.slot,
  attack: e.slot === 'WEAPON' ? e.strength : 0,
  defense: e.slot === 'ARMOR' ? e.strength : 0,
  weightG: e.weightG,
  price: String(e.price),
}));

const citySeed = new Map(CITIES.map((c) => [cityId(c.slug), c]));
const comSeed = new Map(COMMODITIES.map((c) => [comId(c.slug), c]));
const vehSeed = new Map(VEHICLES.map((v) => [`vt_${v.slug}`, v]));
const cityRef = (id: string): C.CityRefDto => {
  const c = cities.find((x) => x.id === id)!;
  return { id: c.id, slug: c.slug, name: c.name };
};

export function distanceKm(a: string, b: string): number {
  const sa = citySeed.get(a)?.slug;
  const sb = citySeed.get(b)?.slug;
  if (!sa || !sb || sa === sb) return 0;
  return DISTANCES[[sa, sb].sort().join('-')] ?? 0;
}

/* ---------------------------------------------------------------- Hilfen */

function rand(s: MockState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = <T>(s: MockState, arr: readonly T[]): T => arr[Math.floor(rand(s) * arr.length)] as T;
const nextId = (s: MockState, prefix: string) => `${prefix}_${(++s.idSeq).toString(36)}`;
const iso = (ms: number) => new Date(ms).toISOString();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Vorläufige Mock-Levelkurve (Backend liefert null, bis Agent 2 sie definiert). */
const xpForNext = (level: number) => 100 * level * level;

const SPREAD = 0.04;
const buyPrice = (mid: number) => Math.round(mid * (1 + SPREAD));
const sellPrice = (mid: number) => Math.floor(mid * (1 - SPREAD));

/** Gleichgewichtspreis aus Angebots-/Nachfragemultiplikatoren der Stadt. */
function targetMid(cId: string, coId: string) {
  const city = citySeed.get(cId)!;
  const com = comSeed.get(coId)!;
  const sup = city.supply[com.slug] ?? 1;
  const dem = (city.demand[com.slug] ?? 1) * city.wealth;
  return com.basePrice * Math.pow(dem / sup, 0.5);
}

/* ------------------------------------------------------------ Initialisierung */

export function createState(now: number = Date.now(), seed = 1337): MockState {
  const s: MockState = {
    version: 2,
    rng: seed,
    lastTick: now,
    idSeq: 0,
    prices: {},
    users: [],
    tokens: {},
    players: {},
    clans: [],
    invites: [],
    ticker: [],
  };
  for (const c of cities) {
    s.prices[c.id] = {};
    for (const com of commodities) {
      s.prices[c.id]![com.id] = {
        mid: Math.round(targetMid(c.id, com.id) * (0.9 + rand(s) * 0.2)),
        supply: Math.round(
          (2_000 + rand(s) * 18_000) * (citySeed.get(c.id)!.supply[comSeed.get(com.id)!.slug] ?? 1),
        ),
        updatedAt: now,
      };
    }
  }
  const botIds: string[] = [];
  BOT_NAMES.forEach((name, i) => {
    const id = nextId(s, 'pl');
    botIds.push(id);
    const level = 1 + Math.floor(rand(s) * 25);
    s.players[id] = {
      ...emptyPlayer(id, name, now - (i + 1) * 86_400_000),
      isBot: true,
      level,
      experience: Math.floor(xpForNext(level - 1) + rand(s) * 50),
      reputation: Math.floor(rand(s) * 5000),
      currentCityId: pick(s, cities).id,
      botWealth: Math.round(500_000 + rand(s) * 400_000_000),
    };
  });
  const ranges: [number, number][] = [
    [0, 5],
    [5, 8],
    [8, 10],
  ];
  const ROLES: C.ClanRoleDto[] = ['GODFATHER', 'CONSIGLIERE', 'CAPO', 'SOLDIER', 'ASSOCIATE'];
  BOT_CLANS.forEach((c, i) => {
    const members = botIds.slice(...(ranges[i] ?? [0, 0]));
    s.clans.push({
      id: nextId(s, 'clan'),
      name: c.name,
      tag: c.tag,
      description: c.description,
      bank: Math.round(2_000_000 + rand(s) * 80_000_000),
      createdAt: now - (30 - i * 7) * 86_400_000,
      members: members.map((pid, j) => ({
        playerId: pid,
        role: ROLES[Math.min(j, ROLES.length - 1)]!,
        joinedAt: now - (20 - j) * 86_400_000,
      })),
    });
  });
  for (let i = 0; i < 6; i++) botTravelTicker(s, now - (6 - i) * 47_000);
  return s;
}

function emptyPlayer(id: string, name: string, now: number): PlayerRow {
  return {
    id,
    name,
    isBot: false,
    cash: START.cash,
    bank: 0,
    health: START.maxHealth,
    maxHealth: START.maxHealth,
    level: 1,
    experience: 0,
    reputation: 0,
    heat: 0,
    currentCityId: null,
    status: 'IDLE',
    statusUntil: null,
    createdAt: now,
    inventory: {},
    vehicles: [],
    equipment: [],
    travel: null,
    notifications: [],
    transactions: [],
  };
}

/* -------------------------------------------------------------- Simulation */

function pushTicker(
  s: MockState,
  type: string,
  message: string,
  at: number,
  data: Record<string, unknown> | null = null,
) {
  s.ticker.unshift({ id: nextId(s, 'tk'), type, message, data, createdAt: iso(at) });
  s.ticker.length = Math.min(s.ticker.length, 50);
}

function botTravelTicker(s: MockState, at: number) {
  const bots = Object.values(s.players).filter((p) => p.isBot);
  if (!bots.length) return;
  const bot = pick(s, bots);
  const city = pick(s, cities);
  bot.currentCityId = city.id;
  pushTicker(s, 'PLAYER_ARRIVED', `${bot.name.toUpperCase()} erreicht die Stadt ${city.name}.`, at);
}

function notify(
  s: MockState,
  p: PlayerRow,
  type: string,
  title: string,
  body: string | null = null,
  data: Record<string, unknown> | null = null,
  at = Date.now(),
) {
  if (p.isBot) return;
  p.notifications.unshift({ id: nextId(s, 'nt'), type, title, body, data, readAt: null, createdAt: iso(at) });
  p.notifications.length = Math.min(p.notifications.length, 100);
}

function book(s: MockState, p: PlayerRow, amount: number, reason: C.TransactionReasonDto, at = Date.now()) {
  p.cash += amount;
  p.transactions.unshift({
    id: nextId(s, 'tx'),
    amount: String(amount),
    balanceAfter: String(p.cash),
    reason,
    refId: null,
    createdAt: iso(at),
  });
  p.transactions.length = Math.min(p.transactions.length, 200);
}

function gainXp(p: PlayerRow, xp: number, s: MockState) {
  p.experience += xp;
  while (p.experience >= xpForNext(p.level)) {
    p.level += 1;
    notify(s, p, 'LEVEL_UP', `Aufstieg auf Level ${p.level}!`, 'Respekt auf der Straße wächst.', {
      link: '/konto',
    });
  }
}

/** Verarbeitet vergangene Ticks und Reiseankünfte („lazy“, ohne Timer). */
export function advance(s: MockState, now: number = Date.now()) {
  const ticks = Math.min(60, Math.floor((now - s.lastTick) / MOCK_TICK_MS));
  for (let t = 0; t < ticks; t++) {
    const at = s.lastTick + (t + 1) * MOCK_TICK_MS;
    for (const cId of Object.keys(s.prices)) {
      for (const [coId, row] of Object.entries(s.prices[cId]!)) {
        const target = targetMid(cId, coId);
        const drift = ((target - row.mid) / target) * 0.08;
        const noise = (rand(s) - 0.5) * 0.08;
        row.mid = Math.round(clamp(row.mid * (1 + drift + noise), target * 0.4, target * 2.5));
        row.supply = Math.round(clamp(row.supply * (0.98 + rand(s) * 0.05), 500, 200_000));
        row.updatedAt = at;
      }
    }
    for (const p of Object.values(s.players)) if (!p.isBot) p.heat = Math.max(0, p.heat - 1);
    if (rand(s) < 0.8) botTravelTicker(s, at);
  }
  if (ticks > 0) s.lastTick += ticks * MOCK_TICK_MS;
  if (now - s.lastTick > MOCK_TICK_MS * 60) s.lastTick = now;

  for (const p of Object.values(s.players)) {
    if (p.travel && p.travel.arr <= now) {
      const to = cityRef(p.travel.to);
      p.currentCityId = to.id;
      p.status = 'IDLE';
      p.statusUntil = null;
      notify(
        s,
        p,
        'TRAVEL_ARRIVED',
        `Angekommen in ${to.name}`,
        'Der Markt wartet. Schau dir die Preise an.',
        { link: '/handel' },
        p.travel.arr,
      );
      pushTicker(s, 'PLAYER_ARRIVED', `${p.name.toUpperCase()} erreicht die Stadt ${to.name}.`, p.travel.arr);
      p.travel = null;
    }
  }
}

/* ------------------------------------------------------------- DTO-Mapping */

const activeVehicleType = (p: PlayerRow) => {
  const v = p.vehicles.find((x) => x.isActive);
  return v ? vehicleTypes.find((t) => t.id === v.typeId) : undefined;
};

/** Laut Vertrag: Kapazität des aktiven Fahrzeugs oder null. */
const contractCapacity = (p: PlayerRow) => activeVehicleType(p)?.capacityG ?? null;
/** Für die Mock-Prüfung: ohne Fahrzeug zählt der Rucksack (player.backpack_capacity). */
const effectiveCapacity = (p: PlayerRow) => contractCapacity(p) ?? START.backpackCapacity * VOLUME_G;

function usedG(p: PlayerRow) {
  let g = 0;
  for (const [id, row] of Object.entries(p.inventory)) g += row.q * (comSeed.get(id)!.volume * VOLUME_G);
  return g;
}

const clanOf = (s: MockState, playerId: string) =>
  s.clans.find((c) => c.members.some((m) => m.playerId === playerId));

export function playerDto(s: MockState, p: PlayerRow): C.PlayerDto {
  const clan = clanOf(s, p.id);
  return {
    id: p.id,
    name: p.name,
    cash: String(p.cash),
    bank: String(p.bank),
    health: p.health,
    maxHealth: p.maxHealth,
    level: p.level,
    experience: p.experience,
    experienceForNextLevel: xpForNext(p.level),
    reputation: p.reputation,
    heat: Math.round(p.heat),
    status: p.status,
    statusUntil: p.statusUntil ? iso(p.statusUntil) : null,
    createdAt: iso(p.createdAt),
    currentCity: p.currentCityId ? cityRef(p.currentCityId) : null,
    clanId: clan?.id ?? null,
    clan: clan
      ? {
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          role: clan.members.find((m) => m.playerId === p.id)!.role,
        }
      : null,
  };
}

export const inventoryDto = (p: PlayerRow): C.InventoryDto => ({
  items: Object.entries(p.inventory)
    .filter(([, r]) => r.q > 0)
    .map(([id, r]) => ({
      commodity: commodities.find((c) => c.id === id)!,
      quantity: r.q,
      avgBuyPrice: String(Math.round(r.avgBuy)),
    })),
  capacityG: contractCapacity(p),
  usedG: usedG(p),
});

function travelDto(p: PlayerRow): C.TravelDto | null {
  if (!p.travel) return null;
  const vt = p.travel.vehicleId ? activeVehicleType(p) : undefined;
  return {
    id: p.travel.id,
    status: 'IN_PROGRESS',
    departedAt: iso(p.travel.dep),
    arrivesAt: iso(p.travel.arr),
    fromCity: cityRef(p.travel.from),
    toCity: cityRef(p.travel.to),
    vehicle:
      vt && p.travel.vehicleId
        ? { id: p.travel.vehicleId, vehicleType: { slug: vt.slug, name: vt.name } }
        : null,
  };
}

const clanListItem = (c: ClanRow): C.ClanListItemDto => ({
  id: c.id,
  name: c.name,
  tag: c.tag,
  description: c.description,
  createdAt: iso(c.createdAt),
  memberCount: c.members.length,
});

const ROLE_ORDER: Record<C.ClanRoleDto, number> = {
  GODFATHER: 0,
  CONSIGLIERE: 1,
  CAPO: 2,
  SOLDIER: 3,
  ASSOCIATE: 4,
};

function clanDetail(s: MockState, c: ClanRow, viewerId: string | null): C.ClanDetailDto {
  const isMember = c.members.some((m) => m.playerId === viewerId);
  return {
    ...clanListItem(c),
    bank: isMember ? String(c.bank) : null,
    members: [...c.members]
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
      .map((m) => {
        const p = s.players[m.playerId]!;
        return {
          playerId: p.id,
          name: p.name,
          level: p.level,
          reputation: p.reputation,
          role: m.role,
          joinedAt: iso(m.joinedAt),
        };
      }),
  };
}

function wealthOf(p: PlayerRow): number {
  return p.isBot ? (p.botWealth ?? 0) : p.cash + p.bank;
}

/* ------------------------------------------------------------------- Auth */

function issueTokens(s: MockState, userId: string) {
  const accessToken = `mock-access.${userId}.${nextId(s, 'a')}`;
  const refreshToken = `mock-refresh.${userId}.${nextId(s, 'r')}`;
  s.tokens[accessToken] = userId;
  s.tokens[refreshToken] = userId;
  return { accessToken, refreshToken };
}

const authResponse = (s: MockState, u: UserRow): C.AuthResponseDto => ({
  ...issueTokens(s, u.id),
  user: { id: u.id, email: u.email, username: u.username, role: 'PLAYER', playerId: u.playerId },
});

export function register(
  s: MockState,
  body: { email?: string; username?: string; password?: string; ageConfirmed?: unknown },
  now = Date.now(),
): C.AuthResponseDto {
  const email = (body.email ?? '').trim().toLowerCase();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (body.ageConfirmed !== true) fail(400, 'VALIDATION_ERROR', 'Altersbestätigung fehlt.');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'VALIDATION_ERROR', 'Ungültige E-Mail-Adresse.');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) fail(400, 'VALIDATION_ERROR', 'Ungültiger Benutzername.');
  if (password.length < 8) fail(400, 'VALIDATION_ERROR', 'Passwort zu kurz.');
  if (s.users.some((u) => u.email === email)) fail(409, 'EMAIL_TAKEN', 'E-Mail bereits vergeben.');
  if (Object.values(s.players).some((p) => p.name.toLowerCase() === username.toLowerCase()))
    fail(409, 'USERNAME_TAKEN', 'Name bereits vergeben.');
  const pid = nextId(s, 'pl');
  const p = emptyPlayer(pid, username, now);
  s.players[pid] = p;
  const user: UserRow = {
    id: nextId(s, 'usr'),
    email,
    username,
    password,
    playerId: pid,
    createdAt: now,
    ageConfirmedAt: now,
  };
  s.users.push(user);
  notify(
    s,
    p,
    'WELCOME',
    'Willkommen auf der Straße',
    'Du startest mit 2.000 € und einem Rucksack. Wähle eine Stadt und mach was draus.',
    { link: '/start' },
    now,
  );
  const clan = s.clans[0];
  if (clan) {
    const leader = clan.members.find((m) => m.role === 'GODFATHER')!;
    s.invites.push({
      id: nextId(s, 'inv'),
      clanId: clan.id,
      playerId: pid,
      invitedById: leader.playerId,
      status: 'PENDING',
      createdAt: now,
    });
    notify(
      s,
      p,
      'CLAN_INVITE',
      `Einladung von [${clan.tag}] ${clan.name}`,
      `${s.players[leader.playerId]!.name} will dich in der Familie sehen.`,
      { link: '/clans' },
      now,
    );
  }
  return authResponse(s, user);
}

export function login(s: MockState, body: { login?: string; password?: string }): C.AuthResponseDto {
  const key = (body.login ?? '').trim().toLowerCase();
  const u = s.users.find((x) => x.email === key || x.username.toLowerCase() === key);
  if (!u || u.password !== body.password) fail(401, 'INVALID_CREDENTIALS', 'Login fehlgeschlagen.');
  return authResponse(s, u!);
}

export function refresh(s: MockState, token?: string): C.AuthResponseDto {
  const uid = token && token.startsWith('mock-refresh.') ? s.tokens[token] : undefined;
  const u = s.users.find((x) => x.id === uid);
  if (!u) return fail(401, 'INVALID_REFRESH_TOKEN', 'Sitzung abgelaufen.');
  delete s.tokens[token!];
  return authResponse(s, u);
}

export function logout(s: MockState, token?: string) {
  if (token) delete s.tokens[token];
}

/** Spieler zum Access-Token. Im Hybrid-Modus (echtes Auth-Backend) wird der Spieler bei Bedarf angelegt. */
export function playerForToken(
  s: MockState,
  token: string | null,
  hybrid = false,
  now = Date.now(),
): PlayerRow {
  if (!token) return fail(401, 'INVALID_ACCESS_TOKEN', 'Nicht angemeldet.');
  const uid = s.tokens[token];
  if (uid) {
    const u = s.users.find((x) => x.id === uid);
    if (u && s.players[u.playerId]) return s.players[u.playerId]!;
    if (u) return fail(404, 'PLAYER_NOT_FOUND', 'Spieler nicht gefunden.');
  }
  if (hybrid) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as {
        sub: string;
        pid?: string;
      };
      const pid = payload.pid ?? payload.sub;
      s.players[pid] ??= emptyPlayer(pid, `Spieler_${pid.slice(-4)}`, now);
      return s.players[pid]!;
    } catch {
      /* fällt durch */
    }
  }
  return fail(401, 'INVALID_ACCESS_TOKEN', 'Sitzung abgelaufen.');
}

/* ------------------------------------------------------------------ Konto */

export function exportData(s: MockState, p: PlayerRow) {
  const u = s.users.find((x) => x.playerId === p.id);
  return {
    exportedAt: iso(Date.now()),
    formatVersion: 1,
    account: u
      ? {
          id: u.id,
          email: u.email,
          username: u.username,
          role: 'PLAYER',
          createdAt: iso(u.createdAt),
          updatedAt: iso(u.createdAt),
          lastLoginAt: null,
          ageConfirmedAt: iso(u.ageConfirmedAt),
        }
      : null,
    sessions: [],
    player: {
      ...playerDto(s, p),
      inventory: inventoryDto(p).items,
      moneyTransactions: p.transactions,
      notifications: p.notifications,
    },
  };
}

export function deleteAccount(s: MockState, p: PlayerRow, password?: string) {
  const u = s.users.find((x) => x.playerId === p.id);
  if (!u || u.password !== password) fail(403, 'INVALID_PASSWORD', 'Passwort falsch.');
  for (const c of s.clans) c.members = c.members.filter((m) => m.playerId !== p.id);
  s.clans = s.clans.filter((c) => c.members.length > 0);
  s.invites = s.invites.filter((i) => i.playerId !== p.id);
  for (const [t, uid] of Object.entries(s.tokens)) if (uid === u!.id) delete s.tokens[t];
  s.users = s.users.filter((x) => x !== u);
  delete s.players[p.id];
}

/* ------------------------------------------------------------- Welt & Markt */

function requireIdleInCity(p: PlayerRow) {
  if (p.status === 'TRAVELING') fail(409, 'PLAYER_BUSY', 'Du bist gerade unterwegs.');
  if (p.status !== 'IDLE') fail(409, 'PLAYER_BUSY', 'Du kannst gerade nicht handeln.');
  if (!p.currentCityId) fail(409, 'NOT_IN_CITY', 'Wähle zuerst eine Startstadt.');
}

const findCity = (slug: string) =>
  cities.find((x) => x.slug === slug) ?? fail(404, 'CITY_NOT_FOUND', 'Stadt nicht gefunden.');

function routeFor(p: PlayerRow | null, from: string, to: string) {
  const d = distanceKm(from, to);
  const vt = p ? activeVehicleType(p) : undefined;
  const seed = vt ? vehSeed.get(vt.id)! : null;
  const speed = seed?.speedKmh ?? TRAIN.speedKmh;
  const cost = seed
    ? Math.round(((d * seed.consumption) / 100) * citySeed.get(from)!.fuelPrice)
    : d * TRAIN.centsPerKm;
  return {
    distanceKm: d,
    durationSeconds: Math.max(15, Math.round(((d / speed) * 3600) / TRAVEL_TIME_SCALE)),
    cost,
  };
}

export function cityDetail(
  _s: MockState,
  p: PlayerRow | null,
  slug: string,
): { city: C.CityDto & { connections: C.ConnectionDto[] } } {
  const c = findCity(slug);
  return {
    city: {
      ...c,
      connections: cities
        .filter((o) => o.id !== c.id)
        .map((o) => {
          const r = routeFor(p, c.id, o.id);
          return {
            toCityId: o.id,
            toCity: cityRef(o.id),
            distanceKm: r.distanceKm,
            durationSeconds: r.durationSeconds,
            cost: String(r.cost),
          };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm),
    },
  };
}

export function market(s: MockState, slug: string): C.MarketDto {
  const c = findCity(slug);
  return {
    city: cityRef(c.id),
    prices: commodities.map((com) => {
      const r = s.prices[c.id]![com.id]!;
      return {
        commodity: com,
        buyPrice: String(buyPrice(r.mid)),
        sellPrice: String(sellPrice(r.mid)),
        supply: r.supply,
        updatedAt: iso(r.updatedAt),
      };
    }),
  };
}

export function overview(s: MockState): C.OverviewDto {
  return {
    commodities: commodities.map((com) => {
      let lowest: C.PricePointDto | null = null;
      let highest: C.PricePointDto | null = null;
      for (const c of cities) {
        const r = s.prices[c.id]![com.id]!;
        const b = buyPrice(r.mid);
        const sp = sellPrice(r.mid);
        if (!lowest || b < Number(lowest.price))
          lowest = { city: cityRef(c.id), price: String(b), updatedAt: iso(r.updatedAt) };
        if (!highest || sp > Number(highest.price))
          highest = { city: cityRef(c.id), price: String(sp), updatedAt: iso(r.updatedAt) };
      }
      return { commodity: com, lowestBuy: lowest, highestSell: highest };
    }),
  };
}

/* ------------------------------------------------- Schreibende Aktionen (draft) */

export function setStartCity(s: MockState, p: PlayerRow, id?: string): { player: C.PlayerDto } {
  if (p.currentCityId || p.status === 'TRAVELING')
    fail(409, 'START_CITY_ALREADY_SET', 'Startstadt bereits gewählt.');
  const c = cities.find((x) => x.id === id) ?? fail(404, 'CITY_NOT_FOUND', 'Stadt nicht gefunden.');
  p.currentCityId = c.id;
  pushTicker(
    s,
    'PLAYER_STARTED',
    `${p.name.toUpperCase()} steigt in ${c.name} ins Geschäft ein.`,
    Date.now(),
  );
  return { player: playerDto(s, p) };
}

export function trade(
  s: MockState,
  p: PlayerRow,
  body: { cityId?: string; commodityId?: string; side?: 'BUY' | 'SELL'; quantity?: number },
  now = Date.now(),
): C.TradeResultDto {
  requireIdleInCity(p);
  const qty = Math.trunc(Number(body.quantity));
  if (!(qty > 0)) fail(400, 'VALIDATION_ERROR', 'Menge muss größer als 0 sein.');
  if (body.cityId !== p.currentCityId) fail(409, 'NOT_IN_CITY', 'Du bist nicht in dieser Stadt.');
  const com =
    commodities.find((c) => c.id === body.commodityId) ??
    fail(404, 'COMMODITY_NOT_FOUND', 'Ware nicht gefunden.');
  const seed = comSeed.get(com.id)!;
  const row = s.prices[p.currentCityId!]![com.id]!;
  const inv = (p.inventory[com.id] ??= { q: 0, avgBuy: 0 });
  let unit: number;
  if (body.side === 'BUY') {
    unit = buyPrice(row.mid);
    if (qty > row.supply) fail(409, 'INSUFFICIENT_STOCK', 'So viel ist nicht verfügbar.');
    if (unit * qty > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
    if (usedG(p) + qty * com.unitWeightG > effectiveCapacity(p))
      fail(409, 'INSUFFICIENT_CAPACITY', 'Nicht genug Laderaum.');
    inv.avgBuy = (inv.avgBuy * inv.q + unit * qty) / (inv.q + qty);
    inv.q += qty;
    row.supply -= qty;
    row.mid = Math.round(row.mid * (1 + Math.min(0.08, qty / Math.max(1, row.supply) / 4)));
    book(s, p, -unit * qty, 'TRADE', now);
    p.heat = clamp(p.heat + ((unit * qty) / 100_000) * 0.5 * seed.heat, 0, 100);
  } else if (body.side === 'SELL') {
    unit = sellPrice(row.mid);
    if (qty > inv.q) fail(409, 'INSUFFICIENT_STOCK', 'So viel hast du nicht dabei.');
    const profit = (unit - inv.avgBuy) * qty;
    inv.q -= qty;
    if (inv.q === 0) inv.avgBuy = 0;
    row.supply += qty;
    row.mid = Math.round(row.mid * (1 - Math.min(0.08, qty / Math.max(1, row.supply) / 4)));
    book(s, p, unit * qty, 'TRADE', now);
    p.heat = clamp(p.heat + ((unit * qty) / 100_000) * 0.5 * seed.heat, 0, 100);
    if (profit > 0) p.reputation += Math.max(1, Math.round(profit / 10_000));
  } else {
    return fail(400, 'VALIDATION_ERROR', 'Ungültige Handelsseite.');
  }
  gainXp(p, Math.min(250, 1 + Math.floor((unit * qty) / 20_000)), s);
  return {
    player: playerDto(s, p),
    inventory: inventoryDto(p),
    transaction: {
      id: nextId(s, 'tr'),
      cityId: p.currentCityId!,
      commodityId: com.id,
      side: body.side,
      quantity: qty,
      unitPrice: String(unit),
      total: String(unit * qty),
      createdAt: iso(now),
    },
  };
}

export const vehiclesOf = (p: PlayerRow): C.VehicleDto[] =>
  p.vehicles.map((v) => ({
    id: v.id,
    condition: v.condition,
    isActive: v.isActive,
    purchasedAt: iso(v.purchasedAt),
    vehicleType: vehicleTypes.find((t) => t.id === v.typeId)!,
  }));

export function buyVehicle(s: MockState, p: PlayerRow, typeId?: string, now = Date.now()) {
  requireIdleInCity(p);
  const t =
    vehicleTypes.find((x) => x.id === typeId) ??
    fail(404, 'VEHICLE_TYPE_NOT_FOUND', 'Fahrzeug nicht gefunden.');
  const price = Number(t.price);
  if (price > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
  book(s, p, -price, 'VEHICLE', now);
  const v = {
    id: nextId(s, 'veh'),
    typeId: t.id,
    condition: 100,
    isActive: !p.vehicles.some((x) => x.isActive),
    purchasedAt: now,
  };
  p.vehicles.push(v);
  return { vehicle: vehiclesOf(p).find((x) => x.id === v.id)!, player: playerDto(s, p) };
}

export function activateVehicle(_s: MockState, p: PlayerRow, id: string) {
  requireIdleInCity(p);
  const target =
    p.vehicles.find((v) => v.id === id) ?? fail(404, 'VEHICLE_NOT_FOUND', 'Fahrzeug nicht gefunden.');
  const prev = p.vehicles.find((v) => v.isActive);
  p.vehicles.forEach((v) => (v.isActive = false));
  target.isActive = true;
  if (usedG(p) > effectiveCapacity(p)) {
    target.isActive = false;
    if (prev) prev.isActive = true;
    fail(409, 'INSUFFICIENT_CAPACITY', 'Deine Ladung passt nicht in dieses Fahrzeug.');
  }
  return { vehicles: vehiclesOf(p) };
}

export function sellVehicle(s: MockState, p: PlayerRow, id: string, now = Date.now()) {
  requireIdleInCity(p);
  const v = p.vehicles.find((x) => x.id === id) ?? fail(404, 'VEHICLE_NOT_FOUND', 'Fahrzeug nicht gefunden.');
  p.vehicles = p.vehicles.filter((x) => x.id !== id);
  if (v.isActive && usedG(p) > effectiveCapacity(p)) {
    p.vehicles.push(v);
    fail(409, 'INSUFFICIENT_CAPACITY', 'Lade erst deine Ware aus.');
  }
  const t = vehicleTypes.find((x) => x.id === v.typeId)!;
  book(s, p, Math.round(Number(t.price) * VEHICLE_RESALE_RATE * (v.condition / 100)), 'VEHICLE', now);
  return { player: playerDto(s, p) };
}

export const equipmentOf = (p: PlayerRow): C.EquipmentDto[] =>
  p.equipment.map((e) => ({
    id: e.id,
    equipped: e.equipped,
    acquiredAt: iso(e.acquiredAt),
    equipmentType: equipmentTypes.find((t) => t.id === e.typeId)!,
  }));

export function buyEquipment(s: MockState, p: PlayerRow, typeId?: string, now = Date.now()) {
  requireIdleInCity(p);
  const t =
    equipmentTypes.find((x) => x.id === typeId) ??
    fail(404, 'EQUIPMENT_TYPE_NOT_FOUND', 'Ausrüstung nicht gefunden.');
  const price = Number(t.price);
  if (price > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
  book(s, p, -price, 'EQUIPMENT', now);
  const hasSlot = p.equipment.some(
    (e) => e.equipped && equipmentTypes.find((x) => x.id === e.typeId)?.slot === t.slot,
  );
  const e = { id: nextId(s, 'eqp'), typeId: t.id, equipped: !hasSlot, acquiredAt: now };
  p.equipment.push(e);
  return { equipment: equipmentOf(p).find((x) => x.id === e.id)!, player: playerDto(s, p) };
}

export function startTravel(
  s: MockState,
  p: PlayerRow,
  toCityId?: string,
  now = Date.now(),
): { travel: C.TravelDto } {
  requireIdleInCity(p);
  const to = cities.find((c) => c.id === toCityId) ?? fail(404, 'CITY_NOT_FOUND', 'Ziel nicht gefunden.');
  if (to.id === p.currentCityId) fail(400, 'VALIDATION_ERROR', 'Du bist schon hier.');
  const r = routeFor(p, p.currentCityId!, to.id);
  if (r.cost > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Geld für die Reise.');
  book(s, p, -r.cost, 'TRAVEL', now);
  const arr = now + r.durationSeconds * 1000;
  p.travel = {
    id: nextId(s, 'trv'),
    from: p.currentCityId!,
    to: to.id,
    vehicleId: p.vehicles.find((v) => v.isActive)?.id ?? null,
    dep: now,
    arr,
  };
  p.status = 'TRAVELING';
  p.statusUntil = arr;
  p.currentCityId = null;
  return { travel: travelDto(p)! };
}

export const currentTravel = (_s: MockState, p: PlayerRow) => ({ travel: travelDto(p) });

/* ------------------------------------------------------------------ Clans */

export const clanList = (s: MockState) => ({
  clans: s.clans.map(clanListItem),
  total: s.clans.length,
  limit: 100,
  offset: 0,
});

export function clanGet(s: MockState, viewer: PlayerRow, id: string) {
  const c = s.clans.find((x) => x.id === id) ?? fail(404, 'CLAN_NOT_FOUND', 'Clan nicht gefunden.');
  return { clan: clanDetail(s, c, viewer.id) };
}

export function clanCreate(
  s: MockState,
  p: PlayerRow,
  body: { name?: string; tag?: string; description?: string },
  now = Date.now(),
) {
  if (clanOf(s, p.id)) fail(409, 'ALREADY_IN_CLAN', 'Du bist bereits in einem Clan.');
  const name = (body.name ?? '').trim();
  const tag = (body.tag ?? '').trim().toUpperCase();
  if (name.length < 3 || name.length > 32) fail(400, 'VALIDATION_ERROR', 'Name: 3–32 Zeichen.');
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) fail(400, 'VALIDATION_ERROR', 'Kürzel: 2–5 Buchstaben/Ziffern.');
  if (s.clans.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.tag === tag))
    fail(409, 'CLAN_NAME_TAKEN', 'Name oder Kürzel vergeben.');
  if (p.cash < CLAN_FOUNDING_COST) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Geld für die Gründung.');
  book(s, p, -CLAN_FOUNDING_COST, 'CLAN', now);
  const c: ClanRow = {
    id: nextId(s, 'clan'),
    name,
    tag,
    description: body.description?.trim() || null,
    bank: 0,
    createdAt: now,
    members: [{ playerId: p.id, role: 'GODFATHER', joinedAt: now }],
  };
  s.clans.push(c);
  pushTicker(s, 'CLAN_FOUNDED', `Neuer Clan gegründet: [${tag}] ${name}.`, now);
  return { clan: clanDetail(s, c, p.id) };
}

export function clanInvite(
  s: MockState,
  p: PlayerRow,
  clanIdArg: string,
  playerName?: string,
  now = Date.now(),
) {
  const c = s.clans.find((x) => x.id === clanIdArg) ?? fail(404, 'CLAN_NOT_FOUND', 'Clan nicht gefunden.');
  const me = c.members.find((m) => m.playerId === p.id);
  if (!me || ROLE_ORDER[me.role] > ROLE_ORDER.CAPO)
    fail(403, 'FORBIDDEN', 'Nur Pate, Consigliere und Capos dürfen einladen.');
  const target =
    Object.values(s.players).find((x) => x.name.toLowerCase() === (playerName ?? '').trim().toLowerCase()) ??
    fail(404, 'PLAYER_NOT_FOUND', 'Spieler nicht gefunden.');
  if (clanOf(s, target.id)) fail(409, 'ALREADY_IN_CLAN', 'Spieler ist bereits in einem Clan.');
  const inv: InviteRow = {
    id: nextId(s, 'inv'),
    clanId: c.id,
    playerId: target.id,
    invitedById: p.id,
    status: 'PENDING',
    createdAt: now,
  };
  s.invites.push(inv);
  notify(
    s,
    target,
    'CLAN_INVITE',
    `Einladung von [${c.tag}] ${c.name}`,
    `${p.name} lädt dich ein.`,
    { link: '/clans' },
    now,
  );
  return { invite: inviteDto(s, inv) };
}

function inviteDto(s: MockState, i: InviteRow): C.ClanInviteDto {
  const c = s.clans.find((x) => x.id === i.clanId)!;
  const by = s.players[i.invitedById];
  return {
    id: i.id,
    createdAt: iso(i.createdAt),
    clan: { id: c.id, name: c.name, tag: c.tag },
    invitedBy: by ? { id: by.id, name: by.name } : null,
  };
}

export const myInvites = (s: MockState, p: PlayerRow) => ({
  invites: s.invites
    .filter((i) => i.playerId === p.id && i.status === 'PENDING' && s.clans.some((c) => c.id === i.clanId))
    .map((i) => inviteDto(s, i)),
});

export function answerInvite(s: MockState, p: PlayerRow, id: string, accept: boolean, now = Date.now()) {
  const i =
    s.invites.find((x) => x.id === id && x.playerId === p.id) ??
    fail(404, 'INVITE_NOT_FOUND', 'Einladung nicht gefunden.');
  if (i.status !== 'PENDING') fail(409, 'INVITE_CLOSED', 'Einladung nicht mehr offen.');
  if (!accept) {
    i.status = 'DECLINED';
    return null;
  }
  if (clanOf(s, p.id)) fail(409, 'ALREADY_IN_CLAN', 'Du bist bereits in einem Clan.');
  const c =
    s.clans.find((x) => x.id === i.clanId) ?? fail(404, 'CLAN_NOT_FOUND', 'Clan existiert nicht mehr.');
  i.status = 'ACCEPTED';
  c.members.push({ playerId: p.id, role: 'ASSOCIATE', joinedAt: now });
  pushTicker(s, 'CLAN_JOINED', `${p.name.toUpperCase()} schließt sich [${c.tag}] an.`, now);
  return { clan: clanDetail(s, c, p.id) };
}

export function leaveClan(s: MockState, p: PlayerRow, id: string) {
  const c = s.clans.find((x) => x.id === id) ?? fail(404, 'CLAN_NOT_FOUND', 'Clan nicht gefunden.');
  const me = c.members.find((m) => m.playerId === p.id) ?? fail(409, 'NOT_IN_CLAN', 'Du bist kein Mitglied.');
  c.members = c.members.filter((m) => m !== me);
  if (c.members.length === 0) s.clans = s.clans.filter((x) => x !== c);
  // Nachfolge des Paten: offene Game-Design-Frage (Wahl, ADR-018) – Mock lässt den Clan ohne Paten.
}

/* --------------------------------------------------------------- Ranglisten */

export function rankings(s: MockState, type: C.RankingTypeDto, limit = 50, offset = 0): C.RankingDto {
  let entries: C.RankingEntryDto[];
  if (type === 'clans') {
    entries = s.clans
      .map((c) => ({
        c,
        v: c.bank + c.members.reduce((sum, m) => sum + wealthOf(s.players[m.playerId]!), 0),
      }))
      .sort((a, b) => b.v - a.v)
      .map(({ c, v }, i) => ({
        rank: i + 1,
        clan: { id: c.id, name: c.name, tag: c.tag, memberCount: c.members.length },
        value: String(v),
      }));
  } else {
    const val = (x: PlayerRow) =>
      type === 'wealth' ? wealthOf(x) : type === 'reputation' ? x.reputation : x.level;
    entries = Object.values(s.players)
      .sort((a, b) => val(b) - val(a) || b.experience - a.experience)
      .map((x, i) => ({
        rank: i + 1,
        player: { id: x.id, name: x.name, level: x.level, clanTag: clanOf(s, x.id)?.tag ?? null },
        value: String(val(x)),
      }));
  }
  return { type, total: entries.length, limit, offset, entries: entries.slice(offset, offset + limit) };
}

/* -------------------------------------------------------- Meldungen & Co. */

export function notifications(p: PlayerRow, unreadOnly = false, limit = 50, offset = 0) {
  const all = unreadOnly ? p.notifications.filter((n) => !n.readAt) : p.notifications;
  return {
    items: all.slice(offset, offset + limit),
    total: all.length,
    unreadCount: p.notifications.filter((n) => !n.readAt).length,
    limit,
    offset,
  };
}

export function readNotification(p: PlayerRow, id: string, now = Date.now()) {
  const n =
    p.notifications.find((x) => x.id === id) ??
    fail(404, 'NOTIFICATION_NOT_FOUND', 'Meldung nicht gefunden.');
  n.readAt ??= iso(now);
  return { notification: n };
}

export function readAll(p: PlayerRow, now = Date.now()) {
  let updated = 0;
  for (const n of p.notifications)
    if (!n.readAt) {
      n.readAt = iso(now);
      updated++;
    }
  return { updated };
}

export const transactions = (p: PlayerRow, limit = 50, offset = 0) => ({
  items: p.transactions.slice(offset, offset + limit),
  total: p.transactions.length,
  limit,
  offset,
});

export const ticker = (s: MockState, limit = 50) => ({ events: s.ticker.slice(0, Math.min(100, limit)) });

export function online(s: MockState): C.OnlineDto {
  const players = Object.values(s.players).slice(0, 20);
  return {
    count: 180 + Math.round((Math.sin(s.lastTick / 3_600_000) + 1) * 60) + players.length,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      clanTag: clanOf(s, p.id)?.tag ?? null,
    })),
  };
}
