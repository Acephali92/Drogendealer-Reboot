/**
 * Szenario-Läufe und Kennzahlen (MARKET_SIMULATION.md §5–6).
 */
import { backgroundProfiles, type ProfileId } from './bots/profiles.js';
import type { Params, Proposals } from './params.js';
import { markets, targetStock } from './model/economy.js';
import { handoverUpdate, npcRouteFlow } from './model/npc.js';
import { uniform } from './rng.js';
import { FAUCETS, type Ledger, SINKS, type SimOptions, World } from './world.js';

export interface Scenario {
  id: string;
  title: string;
  days: number;
  seeds: number;
  background: number;
  tracked: ProfileId[];
  options: Omit<SimOptions, 'seed' | 'days'>;
  /** Kennzeichnet beobachtete Tage für Zeitreihen */
  checkpoints: number[];
  /** Zustrom: Hintergrundspieler wachsen linear von background auf growthTo bis zum letzten Tag */
  growthTo?: number;
  /** F-NPC-04: k täglich aus den Kennzahlen nachführen (setzt options.npc voraus) */
  handover?: boolean;
}

export interface HandoverDay {
  day: number;
  players: number;
  k: number;
  met: boolean;
  routeCompetition: number;
  marketActivity: number;
  peakOnline: number;
}

export interface PlayerResult {
  profile: ProfileId;
  nw: number[];
  ledger: Ledger;
  trips: number;
  busts: number;
  bribesOk: number;
  confiscatedCt: number;
  avgMargin: number;
  milestones: Record<string, number>;
  levelHandel: number;
  levelSchmuggel: number;
  stuckDays: number;
  recoveries: number;
  vehicle: string | null;
}

export interface SeedResult {
  seed: string;
  tracked: PlayerResult[];
  population: { nwFinal: number[]; profiles: ProfileId[] };
  market: {
    /** je Tag: Mittel P/P* über alle Märkte, Anteil knapper Markt-Ticks */
    dailyPriceRatio: number[];
    dailyScarce: number[];
    dailyVolumeCt: number[];
    /** je Markt über den ganzen Lauf */
    perMarket: Record<string, { priceRatio: number; scarce: number; volumeCt: number }>;
  };
  moneySupply: number[];
  handover: HandoverDay[];
  ledger: Ledger;
  events: number;
  invariantViolations: string[];
  stateHash: string;
}

export function runSeed(p: Params, pr: Proposals, sc: Scenario, seed: string): SeedResult {
  const w = new World(p, pr, { ...sc.options, seed, days: sc.days });
  const cities = w.cities;
  const startCity = (i: number) => cities[Math.floor(uniform(seed, 0, `start/${i}`) * cities.length)]!;
  const bg = backgroundProfiles(sc.background);
  bg.forEach((prof, i) => w.addPlayer(`bg${i}`, prof, false, startCity(i)));
  const tracked = sc.tracked.map((prof, i) => w.addPlayer(`tr${prof}${i}`, prof, true, startCity(1000 + i)));
  const nwSeries = tracked.map(() => [] as number[]);
  const dailyPriceRatio: number[] = [];
  const dailyScarce: number[] = [];
  const dailyVolumeCt: number[] = [];
  const perMarket: Record<string, { priceRatio: number; scarce: number; volumeCt: number }> = {};
  const moneySupply: number[] = [];
  const total = sc.days * w.tpd;
  const handover: HandoverDay[] = [];
  const n = (p as { npc?: Record<string, number> }).npc;
  const topRoutes = sc.handover ? topNpcRoutes(p, n?.handover_top_routes ?? 10) : [];
  let met = 0;
  let miss = 0;
  let peak = 0;
  let bgCount = sc.background;
  for (let t = 0; t < total; t++) {
    w.tick();
    peak = Math.max(peak, w.onlineNow);
    if ((t + 1) % w.tpd === 0) {
      const dayNo = (t + 1) / w.tpd;
      if (sc.growthTo !== undefined) {
        const want = Math.round(sc.background + ((sc.growthTo - sc.background) * dayNo) / sc.days);
        const profs = backgroundProfiles(want);
        for (; bgCount < want; bgCount++) w.addPlayer(`bg${bgCount}`, profs[bgCount]!, false, startCity(bgCount));
      }
      if (sc.handover && n) {
        const m = w.handoverMetrics(topRoutes, peak);
        // Ziel-Verfügbarkeit (PvP) ist nicht simuliert → [Annahme] erfüllt
        const ok = m.routeCompetition >= n.handover_route_competition! && m.marketActivity >= n.handover_market_activity! && m.peakOnline >= n.handover_min_peak_online!;
        if (ok) {
          met++;
          miss = 0;
        } else {
          miss++;
          met = 0;
        }
        const k = handoverUpdate(p, w.o.npcIntensity, met, miss);
        (w.o as { npcIntensity: number }).npcIntensity = k;
        handover.push({ day: dayNo, players: w.players.length, k, met: ok, ...m });
      }
      peak = 0;
      tracked.forEach((pl, i) => nwSeries[i]!.push(w.networth(pl)));
      const day = w.takeDayMarketStats();
      dailyPriceRatio.push(mean(day.map((d) => d.priceRatio)));
      dailyScarce.push(mean(day.map((d) => d.scarceShare)));
      dailyVolumeCt.push(day.reduce((a, d) => a + d.volumeCt, 0));
      for (const d of day) {
        const acc = (perMarket[d.key] ??= { priceRatio: 0, scarce: 0, volumeCt: 0 });
        acc.priceRatio += d.priceRatio / sc.days;
        acc.scarce += d.scarceShare / sc.days;
        acc.volumeCt += d.volumeCt;
      }
      moneySupply.push(w.moneySupply());
    }
  }
  const hashInput = JSON.stringify([...w.markets.values()].map((m) => [m.key, m.S.toFixed(6), m.x.toFixed(9)]).concat(w.players.map((pl) => [pl.id, pl.cash, pl.debt] as never)));
  return {
    seed,
    tracked: tracked.map((pl, i) => ({
      profile: pl.profile.id,
      nw: nwSeries[i]!,
      ledger: pl.ledger,
      trips: pl.trips,
      busts: pl.busts,
      bribesOk: pl.bribesOk,
      confiscatedCt: pl.confiscatedCt,
      avgMargin: pl.marginN ? pl.marginSum / pl.marginN : 0,
      milestones: Object.fromEntries(Object.entries(pl.milestones).map(([k, v]) => [k, v / w.tpd])),
      levelHandel: w.levelHandel(pl),
      levelSchmuggel: w.levelSchmuggel(pl),
      stuckDays: pl.stuckDays,
      recoveries: pl.recoveries,
      vehicle: pl.active,
    })),
    population: { nwFinal: w.players.map((pl) => w.networth(pl)), profiles: w.players.map((pl) => pl.profile.id) },
    market: { dailyPriceRatio, dailyScarce, dailyVolumeCt, perMarket },
    moneySupply,
    handover,
    ledger: w.ledger,
    events: w.events,
    invariantViolations: w.invariantViolations,
    stateHash: simpleHash(hashInput),
  };
}

/** Top-Routen nach F-NPC-01-Marge bei k = 0 (Gleichgewichtsbestände), als „von>nach/ware“. */
export function topNpcRoutes(p: Params, n: number): string[] {
  const rows: Array<[string, number]> = [];
  for (const [a, g] of markets(p, 'earth'))
    for (const [b, g2] of markets(p, 'earth')) {
      if (g !== g2 || a === b) continue;
      const f = npcRouteFlow(p, a, b, g, targetStock(p, a, g), targetStock(p, b, g), 0);
      rows.push([`${a}>${b}/${g}`, f.margin]);
    }
  return rows.sort((x, y) => y[1] - x[1]).slice(0, n).map((r) => r[0]);
}

// ---------------------------------------------------------------- Statistik
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export function gini(xs: number[]): number {
  const s = xs.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const n = s.length;
  const sum = s.reduce((a, b) => a + b, 0);
  if (!n || !sum) return 0;
  let acc = 0;
  s.forEach((x, i) => (acc += (2 * (i + 1) - n - 1) * x));
  return acc / (n * sum);
}

export function sfr(ledger: Ledger): number {
  const f = FAUCETS.reduce((a, k) => a + ledger[k], 0);
  const s = SINKS.reduce((a, k) => a + ledger[k], 0);
  return f ? s / f : 0;
}

function simpleHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
