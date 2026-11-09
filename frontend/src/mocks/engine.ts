/**
 * Mock-Spielserver: setzt den API-Vertrag (docs/frontend/API-CONTRACT.md) im Browser um.
 * Nur für Entwicklung/Demo, bis das Backend die Endpunkte liefert. Keine echte Spiellogik –
 * die Regeln definiert Agent 2, die verbindliche Umsetzung Agent 3.
 *
 * Geld wird intern als Zahl in Cent geführt (sicher bis ~9e15) und an der API-Grenze zu Strings.
 */
import type {
  AuthResponse,
  City,
  CityDetail,
  ClanDetail,
  ClanInvite,
  ClanRole,
  ClanSummary,
  Commodity,
  EquipmentType,
  GameNotification,
  Inventory,
  MarketEntry,
  MarketOverview,
  MoneyTransaction,
  NotificationKind,
  Player,
  PlayerEquipment,
  PlayerStatus,
  Ranking,
  RankingRow,
  RankingType,
  TickerEvent,
  TradeResult,
  TradeSide,
  TransactionReason,
  Travel,
  Vehicle,
  VehicleType,
} from '@/api/types';
import {
  BOT_CLANS,
  BOT_NAMES,
  BUS_SPEED_KMH,
  CITIES,
  COMMODITIES,
  EQUIPMENT,
  FUEL_CENTS_PER_KM,
  MOCK_TICK_MS,
  START,
  TRAVEL_TIME_SCALE,
  VEHICLES,
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
  prevMid: number;
  supply: number;
  updatedAt: number;
}

interface InvRow {
  q: number;
  avgBuy: number;
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
  status: PlayerStatus;
  statusUntil: number | null;
  createdAt: number;
  inventory: Record<string, InvRow>;
  vehicles: { id: string; typeId: string; condition: number; isActive: boolean; purchasedAt: number }[];
  equipment: { id: string; typeId: string; equipped: boolean }[];
  travel: { id: string; from: string; to: string; vehicleId: string | null; dep: number; arr: number } | null;
  notifications: GameNotification[];
  transactions: MoneyTransaction[];
  /** Nur Bots: grob geschätztes Vermögen */
  botWealth?: number;
}

interface ClanRow {
  id: string;
  name: string;
  tag: string;
  description?: string;
  bank: number;
  createdAt: number;
  members: { playerId: string; role: ClanRole; joinedAt: number }[];
}

interface InviteRow {
  id: string;
  clanId: string;
  playerId: string;
  invitedById: string;
  status: ClanInvite['status'];
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  password: string;
  playerId: string;
}

export interface MockState {
  version: 1;
  rng: number;
  lastTick: number;
  idSeq: number;
  prices: Record<string, Record<string, PriceRow>>;
  users: UserRow[];
  tokens: Record<string, string>; // token -> userId (access + refresh)
  players: Record<string, PlayerRow>;
  clans: ClanRow[];
  invites: InviteRow[];
  ticker: TickerEvent[];
}

/* -------------------------------------------------------------- Stammdaten */

const cityId = (slug: string) => `city_${slug}`;
const comId = (slug: string) => `com_${slug}`;

export const cities: City[] = CITIES.map((c) => ({
  id: cityId(c.slug),
  slug: c.slug,
  name: c.name,
  country: c.country,
  description: c.description,
  techLevel: c.techLevel,
  policeStrength: c.policeStrength,
  population: c.population,
}));

export const commodities: Commodity[] = COMMODITIES.map((c) => ({
  id: comId(c.slug),
  slug: c.slug,
  name: c.name,
  description: c.description,
  illegal: c.illegal,
  unitWeightG: c.unitWeightG,
  basePrice: String(c.basePrice),
  minPrice: String(Math.round(c.basePrice * 0.4)),
  maxPrice: String(Math.round(c.basePrice * 2.2)),
}));

export const vehicleTypes: VehicleType[] = VEHICLES.map((v) => ({
  id: `vt_${v.slug}`,
  slug: v.slug,
  name: v.name,
  price: String(v.price),
  capacityG: v.capacityG,
  speedKmh: v.speedKmh,
  licenseClass: v.licenseClass,
}));

export const equipmentTypes: EquipmentType[] = EQUIPMENT.map((e) => ({
  id: `eq_${e.slug}`,
  slug: e.slug,
  name: e.name,
  description: e.description,
  slot: e.slot,
  attack: e.attack,
  defense: e.defense,
  price: String(e.price),
  weightG: e.weightG,
}));

const citySeed = new Map(CITIES.map((c) => [cityId(c.slug), c]));
const comSeed = new Map(COMMODITIES.map((c) => [comId(c.slug), c]));

function distanceKm(a: string, b: string): number {
  const A = citySeed.get(a);
  const B = citySeed.get(b);
  if (!A || !B) return 0;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(B.lat - A.lat);
  const dLon = toRad(B.lon - A.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(A.lat)) * Math.cos(toRad(B.lat)) * Math.sin(dLon / 2) ** 2;
  // Straßenfaktor 1.25 gegenüber Luftlinie
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.25);
}

/* ---------------------------------------------------------------- Hilfen */

function rand(s: MockState): number {
  // mulberry32
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
const xpForNext = (level: number) => 100 * level * level;

const SPREAD = 0.04;
const buyPrice = (mid: number) => Math.round(mid * (1 + SPREAD));
const sellPrice = (mid: number) => Math.floor(mid * (1 - SPREAD));

/* ------------------------------------------------------------ Initialisierung */

export function createState(now: number = Date.now(), seed = 1337): MockState {
  const s: MockState = {
    version: 1,
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
    for (const com of COMMODITIES) {
      const mid = Math.round(com.basePrice * (0.65 + rand(s) * 0.8));
      s.prices[c.id]![comId(com.slug)] = {
        mid,
        prevMid: mid,
        supply: Math.round(20_000 + rand(s) * 180_000),
        updatedAt: now,
      };
    }
  }
  // Bots
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
      status: 'IDLE',
      botWealth: Math.round(500_000 + rand(s) * 400_000_000),
    };
  });
  BOT_CLANS.forEach((c, i) => {
    const ranges: [number, number][] = [
      [0, 4],
      [4, 7],
      [7, 10],
    ];
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
        role: j === 0 ? 'LEADER' : j === 1 ? 'OFFICER' : 'MEMBER',
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

function botTravelTicker(s: MockState, at: number) {
  const bots = Object.values(s.players).filter((p) => p.isBot);
  if (!bots.length) return;
  const bot = pick(s, bots);
  const city = pick(s, cities);
  bot.currentCityId = city.id;
  pushTicker(s, `${bot.name.toUpperCase()} erreicht die Stadt ${city.name}.`, at);
}

function pushTicker(s: MockState, text: string, at: number) {
  s.ticker.unshift({ id: nextId(s, 'tk'), text, createdAt: iso(at) });
  s.ticker.length = Math.min(s.ticker.length, 30);
}

function notify(s: MockState, p: PlayerRow, kind: NotificationKind, title: string, body?: string, link?: string, at = Date.now()) {
  if (p.isBot) return;
  p.notifications.unshift({ id: nextId(s, 'nt'), kind, title, body, link, readAt: null, createdAt: iso(at) });
  p.notifications.length = Math.min(p.notifications.length, 100);
}

function book(s: MockState, p: PlayerRow, amount: number, reason: TransactionReason, at = Date.now()) {
  p.cash += amount;
  p.transactions.unshift({
    id: nextId(s, 'tx'),
    amount: String(amount),
    balanceAfter: String(p.cash),
    reason,
    createdAt: iso(at),
  });
  p.transactions.length = Math.min(p.transactions.length, 200);
}

function gainXp(p: PlayerRow, xp: number, s: MockState) {
  p.experience += xp;
  while (p.experience >= xpForNext(p.level)) {
    p.level += 1;
    p.maxHealth += 5;
    p.health = p.maxHealth;
    notify(s, p, 'SYSTEM', `Aufstieg auf Level ${p.level}!`, 'Neue Fahrzeuge und Ausrüstung könnten jetzt für dich verfügbar sein.', '/konto');
  }
}

/** Verarbeitet vergangene Ticks und Reiseankünfte („lazy“, ohne Timer). */
export function advance(s: MockState, now: number = Date.now()) {
  const ticks = Math.min(60, Math.floor((now - s.lastTick) / MOCK_TICK_MS));
  for (let t = 0; t < ticks; t++) {
    const at = s.lastTick + (t + 1) * MOCK_TICK_MS;
    for (const cId of Object.keys(s.prices)) {
      for (const [coId, row] of Object.entries(s.prices[cId]!)) {
        const base = comSeed.get(coId)!.basePrice;
        row.prevMid = row.mid;
        // Zufallsbewegung mit Rückkehr zum Basispreis
        const drift = (base - row.mid) / base * 0.05;
        const noise = (rand(s) - 0.5) * 0.12;
        row.mid = Math.round(clamp(row.mid * (1 + drift + noise), base * 0.4, base * 2.2));
        row.supply = Math.round(clamp(row.supply * (0.98 + rand(s) * 0.05), 5_000, 400_000));
        row.updatedAt = at;
      }
    }
    for (const p of Object.values(s.players)) {
      if (!p.isBot) p.heat = Math.max(0, p.heat - 2);
    }
    if (rand(s) < 0.8) botTravelTicker(s, at);
  }
  if (ticks > 0) s.lastTick += ticks * MOCK_TICK_MS;
  if (now - s.lastTick > MOCK_TICK_MS * 60) s.lastTick = now;

  for (const p of Object.values(s.players)) {
    if (p.travel && p.travel.arr <= now) {
      const to = cities.find((c) => c.id === p.travel!.to)!;
      p.currentCityId = to.id;
      p.status = 'IDLE';
      p.statusUntil = null;
      notify(s, p, 'TRAVEL_ARRIVED', `Angekommen in ${to.name}`, 'Der Markt wartet. Schau dir die Preise an.', '/handel', p.travel.arr);
      pushTicker(s, `${p.name.toUpperCase()} erreicht die Stadt ${to.name}.`, p.travel.arr);
      p.travel = null;
    }
  }
}

/* ------------------------------------------------------------- DTO-Mapping */

function activeVehicle(p: PlayerRow) {
  const v = p.vehicles.find((x) => x.isActive);
  return v ? vehicleTypes.find((t) => t.id === v.typeId) : undefined;
}

function capacityG(p: PlayerRow) {
  return START.pocketCapacityG + (activeVehicle(p)?.capacityG ?? 0);
}

function usedG(p: PlayerRow) {
  let g = 0;
  for (const [id, row] of Object.entries(p.inventory)) g += row.q * (comSeed.get(id)?.unitWeightG ?? 1);
  for (const e of p.equipment) g += equipmentTypes.find((t) => t.id === e.typeId)?.weightG ?? 0;
  return g;
}

function clanOf(s: MockState, playerId: string) {
  return s.clans.find((c) => c.members.some((m) => m.playerId === playerId));
}

export function playerDto(s: MockState, p: PlayerRow): Player {
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
    currentCityId: p.currentCityId,
    status: p.status,
    statusUntil: p.statusUntil ? iso(p.statusUntil) : null,
    clanId: clanOf(s, p.id)?.id ?? null,
    createdAt: iso(p.createdAt),
  };
}

function inventoryDto(p: PlayerRow): Inventory {
  return {
    items: Object.entries(p.inventory)
      .filter(([, r]) => r.q > 0)
      .map(([id, r]) => ({
        commodity: commodities.find((c) => c.id === id)!,
        quantity: r.q,
        avgBuyPrice: String(Math.round(r.avgBuy)),
      })),
    capacityG: capacityG(p),
    usedG: usedG(p),
  };
}

function travelDto(p: PlayerRow): Travel | null {
  if (!p.travel) return null;
  return {
    id: p.travel.id,
    fromCityId: p.travel.from,
    toCityId: p.travel.to,
    vehicleId: p.travel.vehicleId,
    departedAt: iso(p.travel.dep),
    arrivesAt: iso(p.travel.arr),
    status: 'IN_PROGRESS',
  };
}

function clanSummary(s: MockState, c: ClanRow): ClanSummary {
  const leader = c.members.find((m) => m.role === 'LEADER');
  return {
    id: c.id,
    name: c.name,
    tag: c.tag,
    memberCount: c.members.length,
    wealth: String(c.bank + c.members.reduce((sum, m) => sum + wealthOf(s.players[m.playerId]!), 0)),
    leaderName: leader ? s.players[leader.playerId]!.name : '—',
  };
}

function clanDetail(s: MockState, c: ClanRow): ClanDetail {
  return {
    ...clanSummary(s, c),
    description: c.description,
    bank: String(c.bank),
    createdAt: iso(c.createdAt),
    members: c.members.map((m) => {
      const p = s.players[m.playerId]!;
      return { playerId: p.id, name: p.name, role: m.role, level: p.level, joinedAt: iso(m.joinedAt) };
    }),
  };
}

function wealthOf(p: PlayerRow): number {
  if (p.isBot) return p.botWealth ?? 0;
  const inv = Object.values(p.inventory).reduce((sum, r) => sum + r.q * r.avgBuy, 0);
  return Math.round(p.cash + p.bank + inv);
}

/* ------------------------------------------------------------------- Auth */

function issueTokens(s: MockState, userId: string) {
  const accessToken = `mock-access.${userId}.${nextId(s, 'a')}`;
  const refreshToken = `mock-refresh.${userId}.${nextId(s, 'r')}`;
  s.tokens[accessToken] = userId;
  s.tokens[refreshToken] = userId;
  return { accessToken, refreshToken };
}

function authResponse(s: MockState, u: UserRow): AuthResponse {
  return { ...issueTokens(s, u.id), user: { id: u.id, email: u.email, username: u.username, role: 'PLAYER' } };
}

export function register(s: MockState, body: { email?: string; username?: string; password?: string }, now = Date.now()): AuthResponse {
  const email = (body.email ?? '').trim().toLowerCase();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'VALIDATION_ERROR', 'Ungültige E-Mail-Adresse.');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) fail(400, 'VALIDATION_ERROR', 'Ungültiger Benutzername.');
  if (password.length < 8) fail(400, 'VALIDATION_ERROR', 'Passwort zu kurz.');
  if (s.users.some((u) => u.email === email)) fail(409, 'EMAIL_TAKEN', 'E-Mail bereits vergeben.');
  if (Object.values(s.players).some((p) => p.name.toLowerCase() === username.toLowerCase()))
    fail(409, 'USERNAME_TAKEN', 'Name bereits vergeben.');
  const pid = nextId(s, 'pl');
  const p = emptyPlayer(pid, username, now);
  const starter = vehicleTypes.find((v) => v.slug === START.starterVehicle)!;
  p.vehicles.push({ id: nextId(s, 'veh'), typeId: starter.id, condition: 72, isActive: true, purchasedAt: now });
  s.players[pid] = p;
  const user: UserRow = { id: nextId(s, 'usr'), email, username, password, playerId: pid };
  s.users.push(user);
  notify(s, p, 'SYSTEM', 'Willkommen auf der Straße', 'Du startest mit 30.000 € und einer alten Rostlaube. Wähle eine Stadt und mach was draus.', '/start', now);
  // Ein Clan wirbt um Neulinge
  const clan = s.clans[0];
  if (clan) {
    const leader = clan.members.find((m) => m.role === 'LEADER')!;
    s.invites.push({ id: nextId(s, 'inv'), clanId: clan.id, playerId: pid, invitedById: leader.playerId, status: 'PENDING', createdAt: now });
    notify(s, p, 'CLAN_INVITE', `Einladung von [${clan.tag}] ${clan.name}`, `${s.players[leader.playerId]!.name} will dich in der Familie sehen.`, '/clans', now);
  }
  return authResponse(s, user);
}

export function login(s: MockState, body: { login?: string; password?: string }): AuthResponse {
  const key = (body.login ?? '').trim().toLowerCase();
  const u = s.users.find((x) => x.email === key || x.username.toLowerCase() === key);
  if (!u || u.password !== body.password) fail(401, 'INVALID_CREDENTIALS', 'Login fehlgeschlagen.');
  return authResponse(s, u!);
}

export function refresh(s: MockState, token?: string) {
  const uid = token && token.startsWith('mock-refresh.') ? s.tokens[token] : undefined;
  if (!uid) fail(401, 'UNAUTHORIZED', 'Sitzung abgelaufen.');
  delete s.tokens[token!];
  return issueTokens(s, uid!);
}

export function logout(s: MockState, token?: string) {
  if (token) delete s.tokens[token];
}

/** Spieler zum Access-Token. Im Hybrid-Modus (echtes Auth-Backend) wird der Spieler bei Bedarf angelegt. */
export function playerForToken(s: MockState, token: string | null, hybrid = false, now = Date.now()): PlayerRow {
  if (!token) return fail(401, 'UNAUTHORIZED', 'Nicht angemeldet.');
  const uid = s.tokens[token];
  if (uid) {
    const u = s.users.find((x) => x.id === uid);
    if (u) return s.players[u.playerId]!;
  }
  if (hybrid) {
    // JWT des echten Backends: Payload lesen (Signatur prüft das Backend)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string; pid?: string };
      const pid = payload.pid ?? payload.sub;
      if (!s.players[pid]) {
        const p = emptyPlayer(pid, `Spieler_${pid.slice(-4)}`, now);
        const starter = vehicleTypes.find((v) => v.slug === START.starterVehicle)!;
        p.vehicles.push({ id: nextId(s, 'veh'), typeId: starter.id, condition: 72, isActive: true, purchasedAt: now });
        s.players[pid] = p;
      }
      return s.players[pid]!;
    } catch {
      /* fällt durch */
    }
  }
  return fail(401, 'UNAUTHORIZED', 'Sitzung abgelaufen.');
}

/* ------------------------------------------------------------- Spielaktionen */

function requireIdleInCity(p: PlayerRow) {
  if (p.status === 'TRAVELING') fail(409, 'PLAYER_BUSY', 'Du bist gerade unterwegs.');
  if (p.status !== 'IDLE') fail(409, 'PLAYER_BUSY', 'Du kannst gerade nicht handeln.');
  if (!p.currentCityId) fail(409, 'NOT_IN_CITY', 'Wähle zuerst eine Startstadt.');
}

export function setStartCity(s: MockState, p: PlayerRow, cityIdArg: string): Player {
  if (p.currentCityId) fail(409, 'FORBIDDEN', 'Startstadt bereits gewählt.');
  const c = cities.find((x) => x.id === cityIdArg) ?? fail(404, 'NOT_FOUND', 'Stadt nicht gefunden.');
  p.currentCityId = c.id;
  pushTicker(s, `${p.name.toUpperCase()} steigt in ${c.name} ins Geschäft ein.`, Date.now());
  return playerDto(s, p);
}

function travelSpeed(p: PlayerRow) {
  return activeVehicle(p)?.speedKmh ?? BUS_SPEED_KMH;
}

export function cityDetail(_s: MockState, p: PlayerRow | null, slug: string): CityDetail {
  const c = cities.find((x) => x.slug === slug) ?? fail(404, 'NOT_FOUND', 'Stadt nicht gefunden.');
  const speed = p ? travelSpeed(p) : BUS_SPEED_KMH;
  return {
    ...c,
    connections: cities
      .filter((o) => o.id !== c.id)
      .map((o) => {
        const d = distanceKm(c.id, o.id);
        return {
          toCityId: o.id,
          distanceKm: d,
          durationSeconds: Math.max(15, Math.round(((d / speed) * 3600) / TRAVEL_TIME_SCALE)),
          cost: String(d * FUEL_CENTS_PER_KM),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm),
  };
}

export function market(s: MockState, slug: string): MarketEntry[] {
  const c = cities.find((x) => x.slug === slug) ?? fail(404, 'NOT_FOUND', 'Stadt nicht gefunden.');
  return commodities.map((com) => {
    const r = s.prices[c.id]![com.id]!;
    return {
      commodity: com,
      buyPrice: String(buyPrice(r.mid)),
      sellPrice: String(sellPrice(r.mid)),
      supply: r.supply,
      trend: r.mid > r.prevMid ? 'UP' : r.mid < r.prevMid ? 'DOWN' : 'FLAT',
      updatedAt: iso(r.updatedAt),
    };
  });
}

export function overview(s: MockState): MarketOverview {
  const prices: MarketOverview['prices'] = {};
  for (const c of cities) {
    prices[c.id] = {};
    for (const com of commodities) {
      const r = s.prices[c.id]![com.id]!;
      prices[c.id]![com.id] = {
        buyPrice: String(buyPrice(r.mid)),
        sellPrice: String(sellPrice(r.mid)),
        trend: r.mid > r.prevMid ? 'UP' : r.mid < r.prevMid ? 'DOWN' : 'FLAT',
      };
    }
  }
  return { cities, commodities, prices };
}

export function trade(
  s: MockState,
  p: PlayerRow,
  body: { cityId?: string; commodityId?: string; side?: TradeSide; quantity?: number },
  now = Date.now(),
): TradeResult {
  requireIdleInCity(p);
  const qty = Math.trunc(Number(body.quantity));
  if (!(qty > 0)) fail(400, 'VALIDATION_ERROR', 'Menge muss größer als 0 sein.');
  if (body.cityId !== p.currentCityId) fail(409, 'NOT_IN_CITY', 'Du bist nicht in dieser Stadt.');
  const com = commodities.find((c) => c.id === body.commodityId) ?? fail(404, 'NOT_FOUND', 'Ware nicht gefunden.');
  const row = s.prices[p.currentCityId!]![com.id]!;
  const inv = (p.inventory[com.id] ??= { q: 0, avgBuy: 0 });
  let unit: number;
  if (body.side === 'BUY') {
    unit = buyPrice(row.mid);
    if (qty > row.supply) fail(409, 'INSUFFICIENT_STOCK', 'So viel ist nicht verfügbar.');
    if (unit * qty > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
    if (usedG(p) + qty * com.unitWeightG > capacityG(p)) fail(409, 'INSUFFICIENT_CAPACITY', 'Nicht genug Laderaum.');
    inv.avgBuy = (inv.avgBuy * inv.q + unit * qty) / (inv.q + qty);
    inv.q += qty;
    row.supply -= qty;
    row.mid = Math.round(row.mid * (1 + Math.min(0.08, qty / row.supply / 4)));
    book(s, p, -unit * qty, 'TRADE', now);
    if (com.illegal) p.heat = clamp(p.heat + qty / 400, 0, 100);
  } else if (body.side === 'SELL') {
    unit = sellPrice(row.mid);
    if (qty > inv.q) fail(409, 'INSUFFICIENT_STOCK', 'So viel hast du nicht dabei.');
    const profit = (unit - inv.avgBuy) * qty;
    inv.q -= qty;
    if (inv.q === 0) inv.avgBuy = 0;
    row.supply += qty;
    row.mid = Math.round(row.mid * (1 - Math.min(0.08, qty / row.supply / 4)));
    book(s, p, unit * qty, 'TRADE', now);
    if (profit > 0) p.reputation += Math.max(1, Math.round(profit / 50_000));
  } else {
    return fail(400, 'VALIDATION_ERROR', 'Ungültige Handelsseite.');
  }
  gainXp(p, Math.min(250, 1 + Math.floor((unit * qty) / 20_000)), s);
  const transaction = {
    id: nextId(s, 'tr'),
    cityId: p.currentCityId!,
    commodityId: com.id,
    side: body.side,
    quantity: qty,
    unitPrice: String(unit),
    total: String(unit * qty),
    createdAt: iso(now),
  };
  return { player: playerDto(s, p), inventory: inventoryDto(p), transaction };
}

export const inventory = (_s: MockState, p: PlayerRow) => inventoryDto(p);

export function vehiclesOf(p: PlayerRow): Vehicle[] {
  return p.vehicles.map((v) => ({
    id: v.id,
    vehicleType: vehicleTypes.find((t) => t.id === v.typeId)!,
    condition: v.condition,
    isActive: v.isActive,
    purchasedAt: iso(v.purchasedAt),
  }));
}

export function buyVehicle(s: MockState, p: PlayerRow, typeId?: string, now = Date.now()) {
  requireIdleInCity(p);
  const t = vehicleTypes.find((x) => x.id === typeId) ?? fail(404, 'NOT_FOUND', 'Fahrzeug nicht gefunden.');
  if (p.level < t.licenseClass) fail(409, 'LICENSE_REQUIRED', `Führerscheinklasse ${t.licenseClass} erst ab Level ${t.licenseClass}.`);
  const price = Number(t.price);
  if (price > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
  book(s, p, -price, 'VEHICLE', now);
  const v = { id: nextId(s, 'veh'), typeId: t.id, condition: 100, isActive: p.vehicles.length === 0, purchasedAt: now };
  p.vehicles.push(v);
  return { vehicle: vehiclesOf(p).find((x) => x.id === v.id)!, player: playerDto(s, p) };
}

export function activateVehicle(_s: MockState, p: PlayerRow, id: string) {
  requireIdleInCity(p);
  const target = p.vehicles.find((v) => v.id === id) ?? fail(404, 'NOT_FOUND', 'Fahrzeug nicht gefunden.');
  const prev = p.vehicles.find((v) => v.isActive);
  p.vehicles.forEach((v) => (v.isActive = false));
  target.isActive = true;
  if (usedG(p) > capacityG(p)) {
    target.isActive = false;
    if (prev) prev.isActive = true;
    fail(409, 'INSUFFICIENT_CAPACITY', 'Deine Ladung passt nicht in dieses Fahrzeug.');
  }
  return vehiclesOf(p);
}

export function sellVehicle(s: MockState, p: PlayerRow, id: string, now = Date.now()) {
  requireIdleInCity(p);
  const v = p.vehicles.find((x) => x.id === id) ?? fail(404, 'NOT_FOUND', 'Fahrzeug nicht gefunden.');
  const wasActive = v.isActive;
  p.vehicles = p.vehicles.filter((x) => x.id !== id);
  if (wasActive && usedG(p) > capacityG(p)) {
    p.vehicles.push(v);
    fail(409, 'INSUFFICIENT_CAPACITY', 'Lade erst deine Ware aus.');
  }
  const t = vehicleTypes.find((x) => x.id === v.typeId)!;
  book(s, p, Math.round(Number(t.price) * 0.6 * (v.condition / 100)), 'VEHICLE', now);
  return { player: playerDto(s, p) };
}

export function equipmentOf(p: PlayerRow): PlayerEquipment[] {
  return p.equipment.map((e) => ({ id: e.id, equipmentType: equipmentTypes.find((t) => t.id === e.typeId)!, equipped: e.equipped }));
}

export function buyEquipment(s: MockState, p: PlayerRow, typeId?: string, now = Date.now()) {
  requireIdleInCity(p);
  const t = equipmentTypes.find((x) => x.id === typeId) ?? fail(404, 'NOT_FOUND', 'Ausrüstung nicht gefunden.');
  const price = Number(t.price);
  if (price > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Bargeld.');
  if (usedG(p) + t.weightG > capacityG(p)) fail(409, 'INSUFFICIENT_CAPACITY', 'Nicht genug Laderaum.');
  book(s, p, -price, 'COMBAT', now);
  const hasSlot = p.equipment.some((e) => e.equipped && equipmentTypes.find((x) => x.id === e.typeId)?.slot === t.slot);
  const e = { id: nextId(s, 'eqp'), typeId: t.id, equipped: !hasSlot };
  p.equipment.push(e);
  return { equipment: equipmentOf(p).find((x) => x.id === e.id)!, player: playerDto(s, p) };
}

export function startTravel(s: MockState, p: PlayerRow, toCityId?: string, now = Date.now()): Travel {
  requireIdleInCity(p);
  const to = cities.find((c) => c.id === toCityId) ?? fail(404, 'NOT_FOUND', 'Ziel nicht gefunden.');
  if (to.id === p.currentCityId) fail(400, 'VALIDATION_ERROR', 'Du bist schon hier.');
  const from = cities.find((c) => c.id === p.currentCityId)!;
  const conn = cityDetail(s, p, from.slug).connections.find((c) => c.toCityId === to.id)!;
  const cost = Number(conn.cost);
  if (cost > p.cash) fail(409, 'INSUFFICIENT_FUNDS', 'Nicht genug Geld für Sprit.');
  book(s, p, -cost, 'TRAVEL', now);
  const arr = now + conn.durationSeconds * 1000;
  p.travel = { id: nextId(s, 'trv'), from: from.id, to: to.id, vehicleId: p.vehicles.find((v) => v.isActive)?.id ?? null, dep: now, arr };
  p.status = 'TRAVELING';
  p.statusUntil = arr;
  p.currentCityId = null;
  return travelDto(p)!;
}

export const currentTravel = (_s: MockState, p: PlayerRow) => travelDto(p);

/* ------------------------------------------------------------------ Clans */

export const clanList = (s: MockState) =>
  s.clans.map((c) => clanSummary(s, c)).sort((a, b) => Number(BigInt(b.wealth) - BigInt(a.wealth)));

export function clanGet(s: MockState, id: string) {
  const c = s.clans.find((x) => x.id === id) ?? fail(404, 'NOT_FOUND', 'Clan nicht gefunden.');
  return clanDetail(s, c);
}

export const CLAN_FOUNDING_COST = 1_000_000;

export function clanCreate(s: MockState, p: PlayerRow, body: { name?: string; tag?: string; description?: string }, now = Date.now()) {
  if (clanOf(s, p.id)) fail(409, 'ALREADY_IN_CLAN', 'Du bist bereits in einem Clan.');
  const name = (body.name ?? '').trim();
  const tag = (body.tag ?? '').trim().toUpperCase();
  if (name.length < 3 || name.length > 32) fail(400, 'VALIDATION_ERROR', 'Name: 3–32 Zeichen.');
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) fail(400, 'VALIDATION_ERROR', 'Kürzel: 2–5 Buchstaben/Ziffern.');
  if (s.clans.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.tag === tag))
    fail(409, 'CLAN_NAME_TAKEN', 'Name oder Kürzel vergeben.');
  if (p.cash < CLAN_FOUNDING_COST) fail(409, 'INSUFFICIENT_FUNDS', 'Gründung kostet 10.000 €.');
  book(s, p, -CLAN_FOUNDING_COST, 'CLAN', now);
  const c: ClanRow = {
    id: nextId(s, 'clan'),
    name,
    tag,
    description: body.description?.trim() || undefined,
    bank: 0,
    createdAt: now,
    members: [{ playerId: p.id, role: 'LEADER', joinedAt: now }],
  };
  s.clans.push(c);
  pushTicker(s, `Neuer Clan gegründet: [${tag}] ${name}.`, now);
  return clanDetail(s, c);
}

export function clanInvite(s: MockState, p: PlayerRow, clanIdArg: string, playerName?: string, now = Date.now()): ClanInvite {
  const c = s.clans.find((x) => x.id === clanIdArg) ?? fail(404, 'NOT_FOUND', 'Clan nicht gefunden.');
  const me = c.members.find((m) => m.playerId === p.id);
  if (!me || me.role === 'MEMBER') fail(403, 'FORBIDDEN', 'Nur Pate und Capos dürfen einladen.');
  const target =
    Object.values(s.players).find((x) => x.name.toLowerCase() === (playerName ?? '').trim().toLowerCase()) ??
    fail(404, 'NOT_FOUND', 'Spieler nicht gefunden.');
  if (clanOf(s, target.id)) fail(409, 'ALREADY_IN_CLAN', 'Spieler ist bereits in einem Clan.');
  const inv: InviteRow = { id: nextId(s, 'inv'), clanId: c.id, playerId: target.id, invitedById: p.id, status: 'PENDING', createdAt: now };
  s.invites.push(inv);
  notify(s, target, 'CLAN_INVITE', `Einladung von [${c.tag}] ${c.name}`, `${p.name} lädt dich ein.`, '/clans', now);
  return inviteDto(s, inv);
}

function inviteDto(s: MockState, i: InviteRow): ClanInvite {
  return {
    id: i.id,
    clan: clanSummary(s, s.clans.find((c) => c.id === i.clanId)!),
    invitedByName: s.players[i.invitedById]?.name ?? '—',
    status: i.status,
    createdAt: iso(i.createdAt),
  };
}

export const myInvites = (s: MockState, p: PlayerRow) =>
  s.invites.filter((i) => i.playerId === p.id && i.status === 'PENDING' && s.clans.some((c) => c.id === i.clanId)).map((i) => inviteDto(s, i));

export function answerInvite(s: MockState, p: PlayerRow, id: string, accept: boolean, now = Date.now()) {
  const i = s.invites.find((x) => x.id === id && x.playerId === p.id) ?? fail(404, 'NOT_FOUND', 'Einladung nicht gefunden.');
  if (i.status !== 'PENDING') fail(409, 'FORBIDDEN', 'Einladung nicht mehr offen.');
  if (!accept) {
    i.status = 'DECLINED';
    return null;
  }
  if (clanOf(s, p.id)) fail(409, 'ALREADY_IN_CLAN', 'Du bist bereits in einem Clan.');
  const c = s.clans.find((x) => x.id === i.clanId) ?? fail(404, 'NOT_FOUND', 'Clan existiert nicht mehr.');
  i.status = 'ACCEPTED';
  c.members.push({ playerId: p.id, role: 'MEMBER', joinedAt: now });
  pushTicker(s, `${p.name.toUpperCase()} schließt sich [${c.tag}] an.`, now);
  return clanDetail(s, c);
}

export function leaveClan(s: MockState, p: PlayerRow, id: string) {
  const c = s.clans.find((x) => x.id === id) ?? fail(404, 'NOT_FOUND', 'Clan nicht gefunden.');
  const me = c.members.find((m) => m.playerId === p.id) ?? fail(409, 'NOT_IN_CLAN', 'Du bist kein Mitglied.');
  c.members = c.members.filter((m) => m !== me);
  if (c.members.length === 0) s.clans = s.clans.filter((x) => x !== c);
  else if (me.role === 'LEADER') {
    const next = c.members.find((m) => m.role === 'OFFICER') ?? c.members[0]!;
    next.role = 'LEADER';
  }
}

/* --------------------------------------------------------------- Ranglisten */

export function rankings(s: MockState, p: PlayerRow, type: RankingType, limit = 50): Ranking {
  let rows: Omit<RankingRow, 'rank'>[];
  if (type === 'clans') {
    const mine = clanOf(s, p.id)?.id;
    rows = clanList(s).map((c) => ({ id: c.id, name: c.name, tag: c.tag, value: c.wealth, isMe: c.id === mine }));
  } else {
    const val = (x: PlayerRow) =>
      type === 'wealth' ? wealthOf(x) : type === 'reputation' ? x.reputation : x.level * 1e9 + x.experience;
    rows = Object.values(s.players)
      .sort((a, b) => val(b) - val(a))
      .map((x) => ({
        id: x.id,
        name: x.name,
        tag: clanOf(s, x.id)?.tag,
        value: type === 'level' ? String(x.level) : String(val(x)),
        isMe: x.id === p.id,
      }));
  }
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  return { type, rows: ranked.slice(0, limit), me: ranked.find((r) => r.isMe) ?? null };
}

/* -------------------------------------------------------- Meldungen & Co. */

export const notifications = (_s: MockState, p: PlayerRow) => p.notifications;

export function readNotification(p: PlayerRow, id: string | 'all', now = Date.now()) {
  for (const n of p.notifications) if ((id === 'all' || n.id === id) && !n.readAt) n.readAt = iso(now);
}

export const transactions = (p: PlayerRow, limit = 50) => p.transactions.slice(0, limit);
export const ticker = (s: MockState) => s.ticker.slice(0, 20);
export const onlineCount = (s: MockState) => 180 + Math.round((Math.sin(s.lastTick / 3_600_000) + 1) * 60) + Object.values(s.players).filter((p) => !p.isBot).length;
