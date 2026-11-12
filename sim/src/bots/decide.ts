/**
 * Entscheidungslogik der Bots (MARKET_SIMULATION.md §4). Bots sehen, was die API zeigt:
 * aktuelle Preise und Bestände aller Städte (GET /cities/:slug/market, /market/overview).
 */
import { maxOrder } from '../model/trade.js';
import { uniform } from '../rng.js';
import type { Player, World } from '../world.js';

export interface Plan {
  to: string;
  good: string;
  q: number;
  /** erwarteter Erlös inkl. Prognosefaktor */
  expectedRevenue: number;
  /** Erlös zum Abfahrtszeitpunkt ohne Korrektur (Lernbasis) */
  rawRevenue: number;
}

interface Option {
  kind: 'trade' | 'move';
  from: string;
  to: string;
  good: string | null;
  q: number;
  cost: number;
  revenue: number;
  profit: number;
  ticks: number;
  score: number;
}

/** Erwartete Wartezeit (Ticks) zwischen Ankunft und nächster Entscheidung. */
function overhead(w: World, pl: Player): number {
  const s = pl.profile;
  const offline = w.tpd - s.sessionsPerDay * s.sessionTicks;
  return Math.max(0, offline / s.sessionsPerDay / 2);
}

function rand(w: World, pl: Player, tag: string): number {
  return uniform(w.o.seed, w.t, `${tag}/${pl.id}`);
}

/** Bewertet eine Handelsfahrt from→to mit Ware g. Liefert null, wenn nicht handelbar. */
function evalTrade(w: World, pl: Player, from: string, to: string, g: string, budget: number, capacity: number, quick = false): Option | null {
  const good = w.p.goods[g]!;
  if (good.heat > pl.profile.maxGoodHeat) return null;
  const src = w.market(from, g);
  const dst = w.market(to, g);
  if (!src || !dst) return null;
  const travel = w.travelCost(pl, from, to);
  const money = budget - travel.cost;
  if (money <= 0) return null;
  const unit = w.quoteBuy(pl, from, g, 1);
  if (unit === null || unit <= 0) return null;
  let qMax = Math.min(Math.floor(capacity / good.volume), maxOrder(w.p, src.S), Math.floor(money / unit));
  if (qMax <= 0) return null;
  // Budget einhalten (Slippage): q verkleinern, bis Kosten ≤ Budget
  let costMax = w.quoteBuy(pl, from, g, qMax);
  for (let i = 0; i < 12 && (costMax === null || costMax > money); i++) {
    qMax = Math.floor(qMax * (costMax ? Math.min(0.97, money / costMax) : 0.8));
    if (qMax <= 0) return null;
    costMax = w.quoteBuy(pl, from, g, qMax);
  }
  if (costMax === null || costMax > money) return null;
  let best: Option | null = null;
  for (const f of quick ? [1] : [1, 0.6, 0.3]) {
    const q = f === 1 ? qMax : Math.max(1, Math.round(qMax * f));
    const cost = f === 1 ? costMax : w.quoteBuy(pl, from, g, q);
    if (cost === null) continue;
    // Erlös am Ziel heute × gelernter Prognosefaktor (Preise ändern sich während der Fahrt)
    const revenue = Math.floor(w.quoteSell(pl, to, g, q) * pl.forecastBias);
    const risk = w.quoteRisk(pl, from, to, { [g]: q });
    const expLoss = risk.pTotal * (revenue + risk.fine);
    const profit = revenue - cost - travel.cost - pl.profile.riskAversion * expLoss;
    const ticks = travel.ticks + overhead(w, pl);
    const opt: Option = { kind: 'trade', from, to, good: g, q, cost, revenue, profit, ticks, score: profit / ticks };
    if (!best || opt.score > best.score) best = opt;
  }
  return best;
}

function tradeOptions(w: World, pl: Player, from: string, budget: number, capacity: number, quick = false): Option[] {
  const out: Option[] = [];
  for (const g of w.goods) {
    if (!w.market(from, g)) continue;
    for (const to of w.cities) {
      if (to === from) continue;
      const o = evalTrade(w, pl, from, to, g, budget, capacity, quick);
      if (o) out.push(o);
    }
  }
  return out;
}

function best(opts: Option[]): Option | null {
  let b: Option | null = null;
  for (const o of opts) if (!b || o.score > b.score) b = o;
  return b;
}

function freeCapacity(w: World, pl: Player): number {
  return w.capacity(pl) - w.cargoVolume(pl);
}

// ---------------------------------------------------------------- Fahrzeuge
const ORDER = ['kleinwagen', 'transporter', 'sportwagen', 'lkw'];

function unlocked(w: World, pl: Player, v: string): boolean {
  const u = w.p.unlocks[v];
  if (!u?.field || u.level === undefined) return true;
  const lvl = u.field === 'schmuggel' ? w.levelSchmuggel(pl) : u.field === 'handel' ? w.levelHandel(pl) : 0;
  return lvl >= u.level;
}

function maybeBuyVehicle(w: World, pl: Player): void {
  const prof = pl.profile;
  const curCap = w.capacity(pl);
  const resale = pl.active ? Math.floor(w.p.vehicles[pl.active]!.price * (w.p.travel.vehicle_resale_rate ?? 0.6)) : 0;
  const avail = pl.cash + resale;
  const candidates = Object.keys(w.p.vehicles)
    .filter((v) => !pl.vehicles.includes(v) && unlocked(w, pl, v))
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (prof.id === 'D' && rand(w, pl, 'veh') < prof.errorRate) {
    // Fehlkauf: teuerstes bezahlbares Fahrzeug, unabhängig vom Nutzen
    const pick = candidates.filter((v) => w.p.vehicles[v]!.price <= avail * prof.vehicleBudgetShare).pop();
    if (pick) w.buyVehicle(pl, pick);
    return;
  }
  let choice: string | null = null;
  for (const v of candidates) {
    const veh = w.p.vehicles[v]!;
    const cap = w.p.player.backpack_capacity + veh.capacity;
    if (cap <= curCap) continue;
    if (prof.paybackPurchase) {
      // Optimierer: nur kaufen, wenn nach dem Kauf genug Kapital bleibt, um die neue Kapazität zur Hälfte zu füllen
      const opts = tradeOptions(w, pl, pl.city, Number.MAX_SAFE_INTEGER, cap, true);
      const top = best(opts);
      if (!top || top.q <= 0) continue;
      const unitCost = top.cost / top.q;
      const vol = w.p.goods[top.good!]!.volume;
      const fill = (cap / vol) * unitCost * 0.5;
      if (avail - veh.price >= fill) choice = v;
    } else if (veh.price <= avail * prof.vehicleBudgetShare) {
      choice = v;
    }
  }
  if (choice) w.buyVehicle(pl, choice);
}

// ---------------------------------------------------------------- Entscheidung
export function decide(w: World, pl: Player): void {
  // 1. Ladung verkaufen (Bots verkaufen am Ziel bzw. nach Ankunft alles)
  const plan = pl.plan;
  for (const g of [...pl.lots.keys()]) {
    if (!w.market(pl.city, g)) continue;
    const rev = w.sell(pl, g);
    // Lernen: Verhältnis tatsächlicher zu ungekorrigiert erwartetem Erlös (nicht Profil D)
    if (plan && plan.good === g && plan.rawRevenue > 0 && pl.city === plan.to && pl.profile.id !== 'D') {
      const ratio = Math.min(1.5, Math.max(0.3, rev / plan.rawRevenue));
      pl.forecastBias = 0.8 * pl.forecastBias + 0.2 * ratio;
    }
  }
  pl.plan = null;
  // 2. Fahrzeug
  maybeBuyVehicle(w, pl);
  // 3. Route wählen
  const prof = pl.profile;
  const budget = Math.floor(pl.cash * (1 - prof.cashReserve));
  const cap = freeCapacity(w, pl);
  let opts = tradeOptions(w, pl, pl.city, budget, cap);

  // Beste Fahrt ab Stadt c (Schnellbewertung, je Entscheidung zwischengespeichert)
  const cache = new Map<string, Option | null>();
  const follow = (c: string) => {
    if (!cache.has(c)) cache.set(c, best(tradeOptions(w, pl, c, budget, w.capacity(pl), true)));
    return cache.get(c)!;
  };
  if (prof.lookahead) {
    // Rundkurs: Wert der besten Anschlussfahrt ab dem Ziel addieren
    opts = opts.map((o) => {
      const f = follow(o.to);
      if (!f || f.profit <= 0) return o;
      return { ...o, score: (o.profit + f.profit) / (o.ticks + f.ticks) };
    });
  }

  // Leerfahrt zu einer besseren Startstadt (nicht für Ineffiziente)
  if (prof.id !== 'D') {
    for (const c of w.cities) {
      if (c === pl.city) continue;
      const move = w.travelCost(pl, pl.city, c);
      const f = follow(c);
      if (!f || f.profit <= move.cost) continue;
      const ticks = move.ticks + overhead(w, pl) + f.ticks;
      opts.push({ kind: 'move', from: pl.city, to: c, good: null, q: 0, cost: move.cost, revenue: 0, profit: f.profit - move.cost, ticks, score: (f.profit - move.cost) / ticks });
    }
  }

  let choice: Option | null;
  if (prof.errorRate > 0 && rand(w, pl, 'err') < prof.errorRate && opts.length > 0) {
    // Fehlentscheidung: zufällige Option (auch unprofitable)
    choice = opts[Math.floor(rand(w, pl, 'pick') * opts.length)]!;
  } else {
    choice = best(opts.filter((o) => o.profit > 0));
  }
  if (!choice) {
    const broke = pl.cash < w.p.player.start_cash_black / 10 && pl.lots.size === 0;
    // Erholung nach Totalverlust: Fahrzeug verkaufen und mit der Bahn neu anfangen (rationale Spielerreaktion)
    if (broke && pl.active && pl.profile.id !== 'D') {
      w.sellVehicle(pl);
      return;
    }
    // Nichts Profitables: bleiben (Wartezeit). Sackgassen-Zähler (Tage) für Metriken.
    if (broke) pl.stuckDays += 1 / (pl.profile.sessionsPerDay * pl.profile.sessionTicks);
    return;
  }
  if (choice.kind === 'trade' && choice.good) {
    if (!w.buy(pl, choice.good, choice.q)) return;
    pl.marginSum += choice.revenue / Math.max(1, choice.cost) - 1;
    pl.marginN += 1;
    const plan: Plan = { to: choice.to, good: choice.good, q: choice.q, expectedRevenue: choice.revenue, rawRevenue: Math.round(choice.revenue / pl.forecastBias) };
    if (!w.depart(pl, choice.to, plan)) {
      // Abfahrt scheitert (Bargeld): Ware sofort zurückverkaufen
      w.sell(pl, choice.good);
    }
  } else {
    w.depart(pl, choice.to, null);
  }
}
