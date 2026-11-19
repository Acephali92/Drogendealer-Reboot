/**
 * Statische Routenanalyse (SIMULATION_RESULTS.md §1, Befund B-2).
 *
 * Bewertet alle (Ware, Start, Ziel)-Kombinationen auf der Erde für einen Einsteiger:
 * Startkapital 2.000 €, Bahn (nur Rucksack), Gleichgewichtsbestände ohne Rauschen, Heat 0, Level 0.
 * Menge: größte Menge, die Rucksack (Volumen je Einheit), Ordergrenze und Budget (Kapital − Bahnticket) erlauben.
 * Erwartungswert: Erlös − Einkauf − Ticket − p_Kontrolle · Verlust. Verlust = Einkaufswert der Ladung
 * + Strafe (alte Regel, `travel.fine_rate`) bzw. ohne Strafe (ADR-023; mitgeführtes Bargeld gilt
 * als vorher gewaschen [Annahme]).
 *
 *   npx tsx src/routes-static.ts [--set goods.kokain.consumption=0.003] ...
 */
import { loadParams, withOverride, type Params } from './params.js';
import { markets, targetStock, ticksPerHour } from './model/economy.js';
import { buyCost, carryCapacity, maxOrder, sellRevenue } from './model/trade.js';
import { controlProbability, distance, trainCost, travelTicks } from './model/travel.js';

export interface RouteRow {
  good: string;
  from: string;
  to: string;
  q: number;
  profitCt: number;
  evCt: number;
  ticks: number;
  pControl: number;
  eurPerHour: number;
}

export function analyzeRoutes(p: Params, capitalCt = (p.player as { start_cash_black?: number }).start_cash_black ?? 200_000): RouteRow[] {
  const rows: RouteRow[] = [];
  const mk = markets(p, 'earth');
  const cap = carryCapacity(p, null);
  for (const [a, g] of mk)
    for (const [b, g2] of mk) {
      if (g !== g2 || a === b) continue;
      const d = distance(p, a, b);
      const ticket = trainCost(p, d);
      const budget = capitalCt - ticket;
      const Sa = targetStock(p, a, g);
      const Sb = targetStock(p, b, g);
      const qMax = Math.min(Math.floor(cap / p.goods[g]!.volume), maxOrder(p, Sa));
      if (budget <= 0 || qMax < 1) continue;
      // größte bezahlbare Menge (Kosten monoton in q)
      let lo = 0;
      let hi = qMax;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (buyCost(p, a, g, { S: Sa, x: 0 }, mid).cost <= budget) lo = mid;
        else hi = mid - 1;
      }
      const q = lo;
      if (q < 1) continue;
      const cost = buyCost(p, a, g, { S: Sa, x: 0 }, q).cost;
      const revenue = sellRevenue(p, b, g, { S: Sb, x: 0 }, q).revenue;
      const ctrl = controlProbability(p, a, b, { [g]: q }, 0, 0, 0);
      const fine = p.travel.fine_rate === undefined ? 0 : p.travel.fine_rate * q * p.goods[g]!.base_price;
      const profit = revenue - cost - ticket;
      const ev = (1 - ctrl.pTotal) * profit + ctrl.pTotal * (-cost - ticket - fine);
      const ticks = travelTicks(p, d, p.travel.train_speed);
      rows.push({ good: g, from: a, to: b, q, profitCt: profit, evCt: ev, ticks, pControl: ctrl.pTotal, eurPerHour: ev / 100 / (ticks / ticksPerHour(p)) });
    }
  return rows.sort((x, y) => y.eurPerHour - x.eurPerHour);
}

export function routeSummary(rows: RouteRow[]) {
  const prof = rows.filter((r) => r.evCt > 0);
  const s = prof.map((r) => r.eurPerHour).sort((a, b) => a - b);
  const median = s.length ? (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2 : 0;
  const best = prof[0];
  const top10 = prof.slice(0, 10);
  const byGood: Record<string, number> = {};
  for (const r of prof) byGood[r.good] = (byGood[r.good] ?? 0) + 1;
  const bestOf = (pred: (r: RouteRow) => boolean) => prof.find(pred);
  return {
    total: rows.length,
    profitable: prof.length,
    byGood,
    best,
    second: prof[1],
    medianEurPerHour: median,
    dominance: median > 0 && best ? best.eurPerHour / median : NaN,
    cokeShareTop10: top10.length ? top10.filter((r) => r.good === 'kokain').length / top10.length : 0,
    bestNonCoke: bestOf((r) => r.good !== 'kokain'),
  };
}

function fmtRoute(r: RouteRow | undefined): string {
  if (!r) return '–';
  return `\`${r.from} → ${r.to} / ${r.good}\`: ${r.q} Einheiten, Gewinn ${Math.round(r.profitCt / 100)} €, ${r.ticks} Ticks, Kontrolle ${(r.pControl * 100).toFixed(1)} %, ≈ ${Math.round(r.eurPerHour)} €/h`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let p = loadParams().data;
  const sets: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === '--set' && process.argv[i + 1]) sets.push(process.argv[i + 1]!);
  });
  for (const s of sets) {
    const [k, v] = s.split('=');
    p = withOverride(p, k!, Number(v));
  }
  const sum = routeSummary(analyzeRoutes(p));
  console.log(`Overrides: ${sets.join(', ') || '–'}`);
  console.log(`| Kennzahl | Wert |\n|---|---|`);
  console.log(`| profitable Routen (EV > 0) | ${sum.profitable} von ${sum.total} (${((100 * sum.profitable) / sum.total).toFixed(0)} %), ${Object.entries(sum.byGood).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(', ')} |`);
  console.log(`| beste Route | ${fmtRoute(sum.best)} |`);
  console.log(`| zweitbeste | ${fmtRoute(sum.second)} |`);
  console.log(`| beste Route ohne Kokain | ${fmtRoute(sum.bestNonCoke)} |`);
  console.log(`| Median der profitablen Routen | ≈ ${Math.round(sum.medianEurPerHour)} €/h |`);
  console.log(`| Route-Dominanz-Index (beste ÷ Median) | ${sum.dominance.toFixed(1)} |`);
  console.log(`| Kokain-Anteil an den Top-10-Routen | ${(sum.cokeShareTop10 * 100).toFixed(0)} % |`);
}
