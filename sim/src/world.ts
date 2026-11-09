/**
 * Simulationswelt: Märkte der Erde, Spieler-Bots, Tick-Reihenfolge laut Agent 2 (README §4).
 * Nicht abgedeckt (Agent-2-Systeme, spätere Phase): Kampf, Clans, Geldwäsche, Immobilien, Weltraum.
 */
import { decide, type Plan } from './bots/decide.js';
import { type BotProfile, PROFILES, type ProfileId } from './bots/profiles.js';
import {
  ceilCt,
  demand,
  equilibriumPrice,
  type MarketMods,
  marketPrice,
  markets,
  noiseStep,
  pickEvent,
  refStock,
  stockStep,
  targetStock,
} from './model/economy.js';
import {
  combinedNoise,
  consumerSatisfaction,
  policePressureDecay,
  policePressureUpdate,
  supplyResponse,
  wealthCycle,
  weekendFactor,
} from './model/extensions.js';
import { buyCost, carryCapacity, sellRevenue, spoiledQuantity, spread, tradeHeat } from './model/trade.js';
import {
  bust,
  controlProbability,
  distance,
  fuelCost,
  heatDecay,
  level,
  trainCost,
  travelTicks,
  xpHandel,
  xpSchmuggel,
} from './model/travel.js';
import { npcTraderFlows } from './model/npc.js';
import type { Params, Proposals } from './params.js';
import { normal, uniform } from './rng.js';

export interface SimOptions {
  seed: string;
  days: number;
  /** F-ECO-10…14 (wirtschaftliche Eigendynamik) */
  economyExt: boolean;
  /** NPC-Händler F-NPC-01 (Regel, Agent 2) mit Intensität npcIntensity */
  npc: boolean;
  /** NPC-Intensität k (ADR-016, F-NPC-04) */
  npcIntensity: number;
  /** [Design] Agent 5: Kundenbindung/Abwanderung (NPC-1b) und Polizeidruck (NPC-4) */
  npcExt?: boolean;
  /** Startkredit gegen Sackgassen (PROGRESSION_MODEL.md §6) */
  safetyNet: boolean;
  /** Anteil der Ladung, der bei einer Kontrolle beschlagnahmt wird (Agent 2: 1,0; Vorschlag R-1: 0,5) */
  confiscationShare?: number;
}

export interface Market {
  key: string;
  city: string;
  good: string;
  S: number;
  x: number;
  event: string | null;
  r: number;
  /** Erweiterungen */
  sat: number;
  sup: number;
  pStar: number;
  /** Tageswerte für Metriken */
  dayPriceSum: number;
  dayScarceTicks: number;
  dayTicks: number;
  dayVolumeCt: number;
}

export interface Lot {
  q0: number;
  t0: number;
}

export type Ledger = Record<
  'sale' | 'purchase' | 'fuel' | 'train' | 'fine' | 'bribe' | 'vehicleBuy' | 'vehicleSell' | 'loan' | 'debtRepay',
  number
>;

export function emptyLedger(): Ledger {
  return { sale: 0, purchase: 0, fuel: 0, train: 0, fine: 0, bribe: 0, vehicleBuy: 0, vehicleSell: 0, loan: 0, debtRepay: 0 };
}

export const FAUCETS: Array<keyof Ledger> = ['sale', 'vehicleSell', 'loan'];
export const SINKS: Array<keyof Ledger> = ['purchase', 'fuel', 'train', 'fine', 'bribe', 'vehicleBuy', 'debtRepay'];

export interface Trip {
  id: string;
  from: string;
  to: string;
  departTick: number;
  arriveTick: number;
  controlTick: number | null;
  vehicle: string | null;
  km: number;
  hv: number;
  plan: Plan | null;
}

export interface Player {
  id: string;
  profile: BotProfile;
  tracked: boolean;
  cash: number;
  debt: number;
  city: string;
  vehicles: string[];
  active: string | null;
  lots: Map<string, Lot[]>;
  xpHandel: number;
  xpSchmuggel: number;
  heat: Map<string, { H: number; t: number }>;
  trip: Trip | null;
  plan: Plan | null;
  sessions: Array<[number, number]>;
  sessionsDay: number;
  ledger: Ledger;
  trips: number;
  busts: number;
  bribesOk: number;
  confiscatedCt: number;
  marginSum: number;
  marginN: number;
  milestones: Record<string, number>;
  lastLoanDay: number;
  stuckDays: number;
  recoveries: number;
  /** Einkaufsstadt je Ware (für Routen-Kennzahl F-NPC-04) */
  buyCity: Map<string, string>;
  /** Gelernter Prognosefaktor: tatsächlicher ÷ erwarteter Verkaufserlös (gleitender Mittelwert) */
  forecastBias: number;
}

export class World {
  readonly p: Params;
  readonly pr: Proposals;
  readonly o: SimOptions;
  readonly tpd: number;
  readonly cities: string[];
  readonly goods: string[];
  readonly markets = new Map<string, Market>();
  private readonly byCity = new Map<string, Map<string, Market>>();
  readonly players: Player[] = [];
  /** Regionales Rauschen je Ware (F-ECO-11) */
  readonly regionalX = new Map<string, number>();
  readonly cityPhase = new Map<string, number>();
  readonly crisisUntil = new Map<string, number>();
  readonly policePressure = new Map<string, number>();
  readonly ledger: Ledger = emptyLedger();
  t = 0;
  invariantViolations: string[] = [];
  events = 0;
  /** NPC-Händler: bewegte Warenmenge × P_base (ct) */
  npcVolume = 0;

  constructor(p: Params, pr: Proposals, o: SimOptions) {
    this.p = p;
    this.pr = pr;
    this.o = o;
    this.tpd = p.meta.ticks_per_day;
    this.cities = Object.keys(p.city);
    this.goods = [...new Set(markets(p, 'earth').map(([, g]) => g))];
    for (const [city, good] of markets(p, 'earth')) {
      const key = `${city}/${good}`;
      const mk: Market = {
        key,
        city,
        good,
        S: targetStock(p, city, good),
        x: 0,
        event: null,
        r: 0,
        sat: 1,
        sup: 1,
        pStar: equilibriumPrice(p, city, good),
        dayPriceSum: 0,
        dayScarceTicks: 0,
        dayTicks: 0,
        dayVolumeCt: 0,
      };
      this.markets.set(key, mk);
      if (!this.byCity.has(city)) this.byCity.set(city, new Map());
      this.byCity.get(city)!.set(good, mk);
    }
    for (const g of this.goods) this.regionalX.set(g, 0);
    for (const c of this.cities) {
      this.cityPhase.set(c, 2 * Math.PI * uniform(o.seed, 0, `phase/${c}`));
      this.crisisUntil.set(c, -1);
      this.policePressure.set(c, 0);
    }
  }

  // ---------------------------------------------------------------- Spieler
  addPlayer(id: string, profileId: ProfileId, tracked: boolean, startCity: string): Player {
    const pl: Player = {
      id,
      profile: PROFILES[profileId],
      tracked,
      cash: this.p.player.start_cash_black,
      debt: 0,
      city: startCity,
      vehicles: [],
      active: null,
      lots: new Map(),
      xpHandel: 0,
      xpSchmuggel: 0,
      heat: new Map(),
      trip: null,
      plan: null,
      sessions: [],
      sessionsDay: -1,
      ledger: emptyLedger(),
      trips: 0,
      busts: 0,
      bribesOk: 0,
      confiscatedCt: 0,
      marginSum: 0,
      marginN: 0,
      milestones: {},
      lastLoanDay: -999,
      stuckDays: 0,
      recoveries: 0,
      forecastBias: 1,
      buyCity: new Map(),
    };
    this.players.push(pl);
    return pl;
  }

  levelHandel(pl: Player): number {
    return level(this.p, pl.xpHandel);
  }

  levelSchmuggel(pl: Player): number {
    return level(this.p, pl.xpSchmuggel);
  }

  police(city: string): number {
    const base = this.p.city[city]!.police;
    return this.o.npcExt ? Math.min(1, base * (1 + (this.policePressure.get(city) ?? 0))) : base;
  }

  heatOf(pl: Player, city: string): number {
    const h = pl.heat.get(city);
    if (!h) return 0;
    return heatDecay(this.p, h.H, city, this.t - h.t, this.police(city));
  }

  addHeat(pl: Player, city: string, f: (H: number) => number): void {
    pl.heat.set(city, { H: f(this.heatOf(pl, city)), t: this.t });
  }

  cargoQty(pl: Player, good: string): number {
    let q = 0;
    for (const lot of pl.lots.get(good) ?? []) q += spoiledQuantity(this.p, lot.q0, good, this.t - lot.t0);
    return q;
  }

  cargo(pl: Player): Record<string, number> {
    const out: Record<string, number> = {};
    for (const g of pl.lots.keys()) {
      const q = this.cargoQty(pl, g);
      if (q > 0) out[g] = q;
    }
    return out;
  }

  cargoVolume(pl: Player): number {
    let v = 0;
    for (const [g, q] of Object.entries(this.cargo(pl))) v += q * this.p.goods[g]!.volume;
    return v;
  }

  capacity(pl: Player): number {
    return carryCapacity(this.p, pl.active);
  }

  goodsValue(pl: Player): number {
    let v = 0;
    for (const [g, q] of Object.entries(this.cargo(pl))) v += q * this.p.goods[g]!.base_price;
    return v;
  }

  /** F-GLB-03 ohne Clan/Weißgeld: Bargeld − Schuld + Sachwerte (Kaufpreis) + Σ q·P_base. */
  networth(pl: Player): number {
    let assets = 0;
    for (const v of pl.vehicles) assets += this.p.vehicles[v]!.price;
    return pl.cash - pl.debt + assets + this.goodsValue(pl);
  }

  // ---------------------------------------------------------------- Märkte
  mods(m: Market): MarketMods {
    let dem = 1;
    let sup = 1;
    let wealth = 1;
    if (m.event) {
      const ev = this.p.events[m.event]!;
      dem *= ev.demand_mult;
      sup *= ev.supply_mult;
    }
    if (this.o.economyExt) {
      wealth = wealthCycle(this.pr, this.t, this.tpd, this.cityPhase.get(m.city)!);
      if ((this.crisisUntil.get(m.city) ?? -1) > this.t) dem *= this.pr.economy_ext.crisis_demand_mult;
      dem *= weekendFactor(this.pr, this.t, this.tpd, m.good);
      sup *= m.sup;
    }
    if (this.o.npcExt) dem *= m.sat;
    return { demand: dem, supply: sup, wealth };
  }

  marketState(m: Market) {
    return { S: m.S, x: m.x, mods: this.mods(m) };
  }

  price(m: Market): number {
    return marketPrice(this.p, m.city, m.good, m.S, m.x, this.mods(m));
  }

  market(city: string, good: string): Market | undefined {
    return this.byCity.get(city)?.get(good);
  }

  /** Schritt 1 + 2 der Tick-Reihenfolge: Ereignisse, dann Märkte (F-ECO-09, -05, -04, -06). */
  private tickMarkets(): void {
    const { p, o, t } = this;
    if (o.economyExt) {
      for (const g of this.goods) {
        const vol = p.goods[g]!.volatility;
        this.regionalX.set(g, noiseStep(p, this.regionalX.get(g)!, vol, normal(o.seed, t, `region/${g}`, 1)));
      }
      if (t % this.tpd === 0) {
        for (const c of this.cities) {
          if ((this.crisisUntil.get(c) ?? -1) <= t && uniform(o.seed, t, `crisis/${c}`) < this.pr.economy_ext.crisis_probability_per_day) {
            const [lo, hi] = this.pr.economy_ext.crisis_duration_days;
            const days = lo + Math.floor(uniform(o.seed, t, `crisis/${c}`, 1) * (hi - lo + 1));
            this.crisisUntil.set(c, t + days * this.tpd);
            this.events++;
          }
        }
      }
    }
    // 1. Ereignisse (F-ECO-09)
    for (const m of this.markets.values()) {
      if (m.event === null) {
        const ev = pickEvent(p, uniform(o.seed, t, m.key, 0));
        if (ev) {
          m.event = ev;
          m.r = p.events[ev]!.duration;
          m.S *= p.events[ev]!.stock_shock;
          this.events++;
        }
      }
    }
    // 2a. NPC-Händlerflüsse (F-NPC-01, npc.md §5: vor den Märkten)
    if (o.npc) this.npcTraders();
    // 2b. Märkte: Rauschen, Bestand, Preis (F-ECO-05/04/06)
    for (const m of this.markets.values()) {
      const vol = p.goods[m.good]!.volatility;
      const xLocal = noiseStep(p, o.economyExt ? (m as Market & { xl?: number }).xl ?? m.x : m.x, vol, normal(o.seed, t, m.key, 1));
      if (o.economyExt) {
        (m as Market & { xl?: number }).xl = xLocal;
        m.x = combinedNoise(this.pr, xLocal, this.regionalX.get(m.good)!);
      } else {
        m.x = xLocal;
      }
      const mods = this.mods(m);
      m.S = stockStep(p, m.S, targetStock(p, m.city, m.good, mods));
      const P = marketPrice(p, m.city, m.good, m.S, m.x, mods);
      const sRef = refStock(p, m.city, m.good, mods);
      if (o.economyExt) m.sup = supplyResponse(this.pr, m.sup, P / m.pStar);
      if (o.npcExt) m.sat = consumerSatisfaction(this.pr, m.sat, m.S / sRef);
      if (m.event) {
        m.r -= 1;
        if (m.r <= 0) m.event = null;
      }
      m.dayPriceSum += P / m.pStar;
      m.dayTicks += 1;
      if (m.S / sRef < 0.5) m.dayScarceTicks += 1;
    }
    if (o.npcExt) for (const c of this.cities) this.policePressure.set(c, policePressureDecay(this.pr, this.policePressure.get(c)!));
  }

  /** F-NPC-01 (Agent 2, npc.md): NPC-Händlerflüsse, gleichzeitig aus demselben Zustand. */
  private npcTraders(): void {
    const k = this.o.npcIntensity;
    if (k <= 0) return;
    for (const g of this.goods) {
      const list = this.cities.map((c) => this.market(c, g)).filter((m): m is Market => !!m);
      if (list.length < 2) continue;
      const S: Record<string, number> = {};
      for (const m of list) S[m.city] = m.S;
      const next = npcTraderFlows(this.p, g, S, k, (c) => this.mods(this.market(c, g)!));
      for (const m of list) {
        const moved = next[m.city]! - m.S;
        if (moved > 0) this.npcVolume += moved * this.p.goods[g]!.base_price;
        m.S = next[m.city]!;
      }
    }
  }

  // ---------------------------------------------------------------- Handel
  /** F-NPC-04 Kennzahlen: letzter Spieler-Handel je Markt, Verkäufer je Route (Herkunft→Ziel/Ware) */
  readonly marketLastTx = new Map<string, number>();
  readonly routeSellers = new Map<string, Map<string, number>>();
  onlineNow = 0;

  buy(pl: Player, good: string, q: number): boolean {
    const m = this.market(pl.city, good);
    if (!m || q <= 0) return false;
    let res;
    try {
      res = buyCost(this.p, m.city, good, this.marketState(m), q, this.levelHandel(pl));
    } catch {
      return false;
    }
    if (res.cost > pl.cash) return false;
    pl.cash -= res.cost;
    m.S = res.S;
    m.dayVolumeCt += res.cost;
    this.book(pl, 'purchase', res.cost);
    const lots = pl.lots.get(good) ?? [];
    lots.push({ q0: q, t0: this.t });
    pl.lots.set(good, lots);
    pl.buyCity.set(good, pl.city);
    this.marketLastTx.set(m.key, this.t);
    pl.xpHandel += xpHandel(this.p, res.cost);
    this.addHeat(pl, pl.city, (H) => tradeHeat(this.p, H, res.cost, good));
    if (this.o.npcExt) this.policePressure.set(pl.city, policePressureUpdate(this.pr, this.policePressure.get(pl.city)!, res.cost));
    return true;
  }

  sell(pl: Player, good: string): number {
    const m = this.market(pl.city, good);
    const q = this.cargoQty(pl, good);
    pl.lots.delete(good);
    if (!m || q <= 0) return 0;
    const res = sellRevenue(this.p, m.city, good, this.marketState(m), q, this.levelHandel(pl));
    m.S = res.S;
    this.marketLastTx.set(m.key, this.t);
    const from = pl.buyCity.get(good);
    if (from && from !== pl.city) {
      const rk = `${from}>${pl.city}/${good}`;
      if (!this.routeSellers.has(rk)) this.routeSellers.set(rk, new Map());
      this.routeSellers.get(rk)!.set(pl.id, this.t);
    }
    m.dayVolumeCt += res.revenue;
    this.book(pl, 'sale', res.revenue);
    pl.cash += res.revenue;
    if (pl.debt > 0) {
      const pay = Math.min(pl.debt, Math.floor(res.revenue * (this.p.travel.debt_repayment_rate ?? 0.5)));
      pl.debt -= pay;
      pl.cash -= pay;
      this.book(pl, 'debtRepay', pay);
    }
    pl.xpHandel += xpHandel(this.p, res.revenue);
    this.addHeat(pl, pl.city, (H) => tradeHeat(this.p, H, res.revenue, good));
    if (this.o.npcExt) this.policePressure.set(pl.city, policePressureUpdate(this.pr, this.policePressure.get(pl.city)!, res.revenue));
    return res.revenue;
  }

  buyVehicle(pl: Player, v: string): boolean {
    const price = this.p.vehicles[v]!.price;
    const resale = pl.active ? Math.floor(this.p.vehicles[pl.active]!.price * (this.p.travel.vehicle_resale_rate ?? 0.6)) : 0;
    if (pl.cash + resale < price) return false;
    if (pl.active) {
      pl.cash += resale;
      this.book(pl, 'vehicleSell', resale);
      pl.vehicles = pl.vehicles.filter((x) => x !== pl.active);
    }
    pl.cash -= price;
    this.book(pl, 'vehicleBuy', price);
    pl.vehicles.push(v);
    pl.active = v;
    if (pl.milestones[`vehicle:${v}`] === undefined) pl.milestones[`vehicle:${v}`] = this.t;
    return true;
  }

  /** Fahrzeug zum Wiederverkaufswert verkaufen (travel.vehicle_resale_rate). */
  sellVehicle(pl: Player): boolean {
    if (!pl.active) return false;
    const resale = Math.floor(this.p.vehicles[pl.active]!.price * (this.p.travel.vehicle_resale_rate ?? 0.6));
    pl.vehicles = pl.vehicles.filter((x) => x !== pl.active);
    pl.active = null;
    pl.cash += resale;
    this.book(pl, 'vehicleSell', resale);
    pl.recoveries += 1;
    return true;
  }

  // ---------------------------------------------------------------- Reisen
  depart(pl: Player, to: string, plan: Plan | null): boolean {
    const { p } = this;
    const d = distance(p, pl.city, to);
    const vehicle = pl.active;
    const cost = vehicle ? fuelCost(p, d, vehicle, pl.city) : trainCost(p, d);
    if (cost > pl.cash) return false;
    if (!vehicle && this.cargoVolume(pl) > p.player.backpack_capacity) return false;
    pl.cash -= cost;
    this.book(pl, vehicle ? 'fuel' : 'train', cost);
    const T = travelTicks(p, d, vehicle ? p.vehicles[vehicle]!.speed : p.travel.train_speed);
    const cargo = this.cargo(pl);
    const hide = vehicle ? p.vehicles[vehicle]!.hide : 0;
    const c = controlProbability(p, pl.city, to, cargo, this.heatOf(pl, pl.city), hide, this.levelSchmuggel(pl), (cid) => this.police(cid));
    const id = `${pl.id}/${pl.trips}`;
    let controlTick: number | null = null;
    if (Object.keys(cargo).length > 0) {
      // F-TRV-04: Segmente j = 1…n bei Abfahrt würfeln, erste Kontrolle bei t + ⌈T·j/n⌉ [Annahme: j ab 1]
      for (let j = 1; j <= c.n; j++) {
        if (uniform(this.o.seed, this.t, `trip/${id}`, j) < c.pSeg) {
          controlTick = this.t + Math.ceil((T * j) / c.n);
          break;
        }
      }
    }
    pl.trip = { id, from: pl.city, to, departTick: this.t, arriveTick: this.t + T, controlTick, vehicle, km: d, hv: c.hv, plan };
    pl.trips += 1;
    return true;
  }

  private control(pl: Player): void {
    const trip = pl.trip!;
    const cargo = this.cargo(pl);
    if (Object.keys(cargo).length === 0) return;
    const policeAvg = (this.police(trip.from) + this.police(trip.to)) / 2;
    const b = bust(this.p, cargo, policeAvg, this.levelSchmuggel(pl));
    pl.busts += 1;
    const expectedSale = trip.plan?.expectedRevenue ?? b.cargoBaseValue;
    let tryBribe = false;
    if (pl.profile.bribe === 'always') tryBribe = true;
    else if (pl.profile.bribe === 'ev') tryBribe = -b.bribeCost - (1 - b.bribeChance) * (expectedSale + b.fine) > -(expectedSale + b.fine);
    if (tryBribe && pl.cash >= b.bribeCost) {
      pl.cash -= b.bribeCost;
      this.book(pl, 'bribe', b.bribeCost);
      if (uniform(this.o.seed, this.t, `bribe/${trip.id}`) < b.bribeChance) {
        pl.bribesOk += 1;
        return;
      }
    }
    // Kooperieren bzw. Bestechung gescheitert: Beschlagnahme + Strafe (F-TRV-06)
    const share = this.o.confiscationShare ?? 1;
    pl.confiscatedCt += Math.round(b.cargoBaseValue * share);
    if (share >= 1) pl.lots.clear();
    else for (const lots of pl.lots.values()) for (const lot of lots) lot.q0 = Math.floor(lot.q0 * (1 - share));
    const fine = Math.ceil(b.fine * share);
    const paid = Math.min(pl.cash, fine);
    pl.cash -= paid;
    this.book(pl, 'fine', paid);
    pl.debt += fine - paid;
    this.addHeat(pl, trip.to, (H) => Math.min(this.p.heat.max, H + this.p.travel.heat_on_bust));
    if (pl.trip) pl.trip.plan = null;
  }

  private arrive(pl: Player): void {
    const trip = pl.trip!;
    if (Object.keys(this.cargo(pl)).length > 0) pl.xpSchmuggel += xpSchmuggel(this.p, trip.km, trip.hv);
    pl.city = trip.to;
    pl.plan = trip.plan;
    pl.trip = null;
  }

  private book(pl: Player, cat: keyof Ledger, amount: number): void {
    pl.ledger[cat] += amount;
    this.ledger[cat] += amount;
  }

  // ---------------------------------------------------------------- Aktivität
  isOnline(pl: Player): boolean {
    const day = Math.floor(this.t / this.tpd);
    if (pl.sessionsDay !== day) {
      pl.sessionsDay = day;
      pl.sessions = [];
      for (let k = 0; k < pl.profile.sessionsPerDay; k++) {
        const start = day * this.tpd + Math.floor(uniform(this.o.seed, day, `session/${pl.id}`, k) * (this.tpd - pl.profile.sessionTicks));
        pl.sessions.push([start, start + pl.profile.sessionTicks]);
      }
    }
    return pl.sessions.some(([a, b]) => this.t >= a && this.t < b);
  }

  // ---------------------------------------------------------------- Tick
  moneySupply(): number {
    let m = 0;
    for (const pl of this.players) m += pl.cash;
    return m;
  }

  tick(): void {
    const before = this.moneySupply();
    const ledgerBefore = { ...this.ledger };
    this.tickMarkets();
    // Schritt 3: Reisen (Kontrollen beim vorab gewürfelten Tick, dann Ankünfte)
    for (const pl of this.players) {
      if (!pl.trip) continue;
      if (pl.trip.controlTick !== null && pl.trip.controlTick <= this.t) {
        pl.trip.controlTick = null;
        this.control(pl);
      }
      if (pl.trip && pl.trip.arriveTick <= this.t) this.arrive(pl);
    }
    // Schritte 4–6 (Betriebe, Geldwäsche, Clans): nicht simuliert.
    // Spieleraktionen (zwischen Ticks, hier am Tick-Ende in zufälliger Reihenfolge)
    const order = this.players.map((pl, i) => [uniform(this.o.seed, this.t, `order/${i}`), pl] as const).sort((a, b) => a[0] - b[0]);
    this.onlineNow = 0;
    for (const [, pl] of order) {
      const online = this.isOnline(pl);
      if (online) this.onlineNow++;
      if (pl.trip || !online) continue;
      this.safetyNet(pl);
      decide(this, pl);
    }
    this.checkInvariants(before, ledgerBefore);
    this.t += 1;
  }

  private safetyNet(pl: Player): void {
    if (!this.o.safetyNet) return;
    const day = Math.floor(this.t / this.tpd);
    const sn = this.pr.safety_net;
    if (pl.cash + this.goodsValue(pl) < sn.min_cash_threshold_ct && day - pl.lastLoanDay >= sn.cooldown_days) {
      pl.cash += sn.start_loan_ct;
      pl.debt += sn.start_loan_ct;
      this.book(pl, 'loan', sn.start_loan_ct);
      pl.lastLoanDay = day;
    }
  }

  /** I-1 Geldbilanz, I-4 keine negativen Bestände/Bargeld, Preise in Grenzen. */
  private checkInvariants(before: number, ledgerBefore: Ledger): void {
    if (this.invariantViolations.length > 20) return;
    let faucets = 0;
    let sinks = 0;
    for (const k of FAUCETS) faucets += this.ledger[k] - ledgerBefore[k];
    for (const k of SINKS) sinks += this.ledger[k] - ledgerBefore[k];
    // Schuldentilgung bewegt Bargeld ohne Quelle/Senke → separat erfassen
    const after = this.moneySupply();
    if (after - before !== faucets - sinks) this.invariantViolations.push(`I-1 Tick ${this.t}: ΔM=${after - before}, Quellen−Senken=${faucets - sinks}`);
    for (const pl of this.players) {
      if (pl.cash < 0 || !Number.isSafeInteger(pl.cash)) this.invariantViolations.push(`I-4 Tick ${this.t}: Bargeld ${pl.id}=${pl.cash}`);
    }
    for (const m of this.markets.values()) {
      if (!(m.S >= this.p.economy.min_stock - 1e-9)) this.invariantViolations.push(`I-4 Tick ${this.t}: Bestand ${m.key}=${m.S}`);
    }
  }

  /** Für Metriken: Tagesweise Marktkennzahlen zurücksetzen. */
  takeDayMarketStats(): Array<{ key: string; priceRatio: number; scarceShare: number; volumeCt: number }> {
    const out = [];
    for (const m of this.markets.values()) {
      out.push({ key: m.key, priceRatio: m.dayTicks ? m.dayPriceSum / m.dayTicks : 1, scarceShare: m.dayTicks ? m.dayScarceTicks / m.dayTicks : 0, volumeCt: m.dayVolumeCt });
      m.dayPriceSum = 0;
      m.dayScarceTicks = 0;
      m.dayTicks = 0;
      m.dayVolumeCt = 0;
    }
    return out;
  }

  /** Erwarteter Erlös einer Ware am Zielmarkt beim aktuellen Zustand (für Bots). */
  quoteSell(pl: Player, city: string, good: string, q: number): number {
    const m = this.market(city, good);
    if (!m || q <= 0) return 0;
    return sellRevenue(this.p, city, good, this.marketState(m), q, this.levelHandel(pl)).revenue;
  }

  quoteBuy(pl: Player, city: string, good: string, q: number): number | null {
    const m = this.market(city, good);
    if (!m || q <= 0) return null;
    try {
      return buyCost(this.p, city, good, this.marketState(m), q, this.levelHandel(pl)).cost;
    } catch {
      return null;
    }
  }

  travelCost(pl: Player, from: string, to: string): { cost: number; ticks: number } {
    const d = distance(this.p, from, to);
    if (pl.active) return { cost: fuelCost(this.p, d, pl.active, from), ticks: travelTicks(this.p, d, this.p.vehicles[pl.active]!.speed) };
    return { cost: trainCost(this.p, d), ticks: travelTicks(this.p, d, this.p.travel.train_speed) };
  }

  /** Für Bots: Kontrollwahrscheinlichkeit und Strafe einer geplanten Ladung. */
  quoteRisk(pl: Player, from: string, to: string, cargo: Record<string, number>): { pTotal: number; fine: number; baseValue: number } {
    const hide = pl.active ? this.p.vehicles[pl.active]!.hide : 0;
    const c = controlProbability(this.p, from, to, cargo, this.heatOf(pl, from), hide, this.levelSchmuggel(pl), (cid) => this.police(cid));
    const b = bust(this.p, cargo, c.policeAvg, this.levelSchmuggel(pl));
    return { pTotal: c.pTotal, fine: b.fine, baseValue: b.cargoBaseValue };
  }

  /** F-NPC-04: Tageskennzahlen aus Spieleraktionen (Ziel-Verfügbarkeit PvP nicht simuliert). */
  handoverMetrics(topRoutes: string[], peakOnline: number) {
    const win = 1008;
    let competed = 0;
    for (const rk of topRoutes) {
      const sellers = this.routeSellers.get(rk);
      let n = 0;
      if (sellers) for (const t of sellers.values()) if (this.t - t < win) n++;
      if (n >= 2) competed++;
    }
    let active = 0;
    for (const m of this.markets.values()) if (this.t - (this.marketLastTx.get(m.key) ?? -1e9) < this.tpd) active++;
    return { routeCompetition: competed / topRoutes.length, marketActivity: active / this.markets.size, peakOnline };
  }

  ceil(x: number): number {
    return ceilCt(x);
  }
}
