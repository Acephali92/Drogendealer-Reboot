/**
 * Golden Vectors: Die Übergangs-Formelschicht (src/model) muss die Beispielwerte von Agent 2
 * (verify.py, EX-*) exakt reproduzieren. Quelle der Sollwerte: JSON-Export von verify.py
 * (ENV SIM_GOLDEN oder docs/game-design/golden.json). Fehlen Parameter oder Sollwerte,
 * wird die Suite mit Hinweis übersprungen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { equilibriumPrice, demand, halfLife, marketPrice, noiseStep, refStock, stockAfter, supplyLevel, targetStock, ticksPerHour } from '../src/model/economy.js';
import { buyCost, carryCapacity, sellRevenue, spoiledQuantity, spread, tradeHeat, bonus } from '../src/model/trade.js';
import { availability, bust, controlProbability, distance, fuelCost, heatDecay, level, trainCost, travelTicks, xpForLevel, xpHandel, xpSchmuggel } from '../src/model/travel.js';
import { loadParams, paramsAvailable, REPO_ROOT } from '../src/params.js';
import { normal, uniform } from '../src/rng.js';
import { handoverRun, npcEquilibrium, npcRouteFlow } from '../src/model/npc.js';

// SIM_GOLDEN setzt test/golden-setup.ts (Export aus verify.py) oder der Aufrufer
const goldenPath = resolve(process.env.SIM_GOLDEN ?? resolve(REPO_ROOT, 'docs/game-design/golden.json'));
const ready = paramsAvailable() && existsSync(goldenPath);
if (!ready) console.warn(`[golden] übersprungen: parameters.toml oder ${goldenPath} fehlt (Agent 2, docs/game-design/).`);

const r = (x: number, nd = 4) => Math.round(x * 10 ** nd) / 10 ** nd;

describe.skipIf(!ready)('Golden Vectors (Agent 2, verify.py)', () => {
  const p = ready ? loadParams().data : (undefined as never);
  const G: Record<string, Record<string, number | string>> = ready ? JSON.parse(readFileSync(goldenPath, 'utf8')) : {};
  const ex = (id: string, actual: Record<string, number | string>) => {
    const exp = G[id];
    expect(exp, `${id} fehlt in golden.json`).toBeDefined();
    for (const [k, v] of Object.entries(exp!)) {
      if (typeof v === 'number') expect(actual[k], `${id}.${k}`).toBeCloseTo(v, 6);
      else expect(actual[k], `${id}.${k}`).toBe(v);
    }
  };

  it('EX-GLB-01 RNG', () => ex('EX-GLB-01', { U: r(uniform('demo-server', 1, 'berlin/gras'), 6), Z: r(normal('demo-server', 1, 'berlin/gras'), 6) }));

  it('EX-ECO-01 Gleichgewichtspreise', () => {
    const a = equilibriumPrice(p, 'amsterdam', 'gras');
    const m = equilibriumPrice(p, 'muenchen', 'gras');
    ex('EX-ECO-01', { P_amsterdam: r(a, 2), P_muenchen: r(m, 2), ratio: r(m / a) });
  });

  it('EX-ECO-02 Markttiefe', () => {
    const St = targetStock(p, 'rotterdam', 'kokain');
    ex('EX-ECO-02', {
      D: r(demand(p, 'rotterdam', 'kokain')),
      A: r(supplyLevel(p, 'rotterdam', 'kokain')),
      S_ref: r(refStock(p, 'rotterdam', 'kokain'), 2),
      S_target: r(St, 2),
      P: r(marketPrice(p, 'rotterdam', 'kokain', St), 2),
    });
  });

  it('EX-ECO-03 Erholung', () => {
    const St = targetStock(p, 'rotterdam', 'kokain');
    const S0 = St - 200;
    const S34 = stockAfter(p, S0, St, 34);
    const S144 = stockAfter(p, S0, St, 144);
    const P = (S: number) => r(marketPrice(p, 'rotterdam', 'kokain', S), 2);
    ex('EX-ECO-03', { S0: r(S0, 2), P0: P(S0), S34: r(S34, 2), P34: P(S34), S144: r(S144, 2), P144: P(S144) });
  });

  it('EX-ECO-04 Halbwertszeit', () => {
    const t = halfLife(p.economy.reversion_rate);
    ex('EX-ECO-04', { ticks: r(t, 2), hours: r(t / ticksPerHour(p), 2) });
  });

  it('EX-ECO-05 Razzia', () => {
    const St = targetStock(p, 'berlin', 'gras');
    const S1 = St * p.events.razzia!.stock_shock;
    const p0 = marketPrice(p, 'berlin', 'gras', St);
    const p1 = marketPrice(p, 'berlin', 'gras', S1);
    ex('EX-ECO-05', { S_target: r(St, 2), S_after: r(S1, 2), P_before: r(p0, 2), P_after: r(p1, 2), factor: r(p1 / p0) });
  });

  it('EX-ECO-06 Rauschen', () => {
    const x1 = noiseStep(p, 0.02, p.goods.gras!.volatility, -1);
    ex('EX-ECO-06', { x1: r(x1, 6), N: r(Math.exp(x1), 6) });
  });

  it('EX-TRD-01…03 Kauf, Verkauf, Rund-Trip', () => {
    const buy = buyCost(p, 'rotterdam', 'kokain', { S: targetStock(p, 'rotterdam', 'kokain'), x: 0 }, 200);
    ex('EX-TRD-01', { cost: buy.cost, avg: r(buy.cost / 200, 2), S_after: r(buy.S, 2) });
    const sell = sellRevenue(p, 'muenchen', 'kokain', { S: targetStock(p, 'muenchen', 'kokain'), x: 0 }, 200);
    ex('EX-TRD-02', { revenue: sell.revenue, avg: r(sell.revenue / 200, 2), S_after: r(sell.S, 2) });
    const back = sellRevenue(p, 'rotterdam', 'kokain', { S: buy.S, x: 0 }, 200);
    ex('EX-TRD-03', { cost: buy.cost, revenue: back.revenue, loss: buy.cost - back.revenue });
  });

  it('EX-TRD-04…06 Verderb, Heat, Kapazität', () => {
    ex('EX-TRD-04', { Q_day: spoiledQuantity(p, 100, 'pilze', 144), Q_week: spoiledQuantity(p, 100, 'pilze', 1008) });
    ex('EX-TRD-05', { H: r(tradeHeat(p, 0, 1126303, 'kokain')) });
    const cap = carryCapacity(p, 'kleinwagen');
    ex('EX-TRD-06', { capacity: cap, max_gras: Math.floor(cap / p.goods.gras!.volume), max_kokain: Math.floor(cap / p.goods.kokain!.volume) });
  });

  it('EX-CTY-01…03 Städte', () => {
    ex('EX-CTY-01', {
      D: r(demand(p, 'berlin', 'ecstasy')),
      S_ref: r(refStock(p, 'berlin', 'ecstasy'), 2),
      S_target: r(targetStock(p, 'berlin', 'ecstasy'), 2),
      P_eq: r(equilibriumPrice(p, 'berlin', 'ecstasy'), 2),
    });
    ex('EX-CTY-02', { H_muenchen: r(heatDecay(p, 50, 'muenchen', 144), 2), H_amsterdam: r(heatDecay(p, 50, 'amsterdam', 144), 2) });
    const S = targetStock(p, 'rotterdam', 'kokain') - 200;
    const ref = refStock(p, 'rotterdam', 'kokain');
    ex('EX-CTY-03', { v: r(S / ref), label: availability(S, ref) });
  });

  it('EX-TRV-01…04 Reisen und Kontrollen', () => {
    const d = distance(p, 'berlin', 'hamburg');
    ex('EX-TRV-01', {
      T_car: travelTicks(p, d, p.vehicles.kleinwagen!.speed),
      fuel: fuelCost(p, d, 'kleinwagen', 'berlin'),
      T_train: travelTicks(p, d, p.travel.train_speed),
      train: trainCost(p, d),
    });
    const c = controlProbability(p, 'rotterdam', 'muenchen', { kokain: 200 }, 10, p.vehicles.transporter!.hide, 4);
    ex('EX-TRV-02', { n: c.n, police_avg: r(c.policeAvg, 6), hv: r(c.hv, 6), g: r(c.g, 6), p_seg: r(c.pSeg, 6), p_total: r(c.pTotal, 6) });
    const b = bust(p, { kokain: 200 }, c.policeAvg, 4);
    ex('EX-TRV-03', { cargo_base_value: b.cargoBaseValue, fine: b.fine, bribe_cost: b.bribeCost, bribe_chance: r(b.bribeChance) });
    const buy = buyCost(p, 'rotterdam', 'kokain', { S: targetStock(p, 'rotterdam', 'kokain'), x: 0 }, 200).cost;
    const rev = sellRevenue(p, 'muenchen', 'kokain', { S: targetStock(p, 'muenchen', 'kokain'), x: 0 }, 200).revenue;
    const dd = distance(p, 'rotterdam', 'muenchen');
    const fuel = fuelCost(p, dd, 'transporter', 'rotterdam');
    // verify.py rechnet mit dem auf 6 Stellen gerundeten p_total aus EX-TRV-02
    const pt = r(c.pTotal, 6);
    const evv = (1 - pt) * rev - buy - fuel - pt * b.fine;
    ex('EX-TRV-04', { fuel, T: travelTicks(p, dd, p.vehicles.transporter!.speed), profit_no_bust: rev - buy - fuel, EV: Math.floor(evv + 0.5) });
  });

  it.skipIf(!('EX-NPC-01' in G))('EX-NPC-01 NPC-Händler (F-NPC-01)', () => {
    const out: Record<string, number> = {};
    for (const k of [0, 1]) {
      const S = npcEquilibrium(p, 'kokain', k);
      const pr = marketPrice(p, 'rotterdam', 'kokain', S.rotterdam!);
      const pm = marketPrice(p, 'muenchen', 'kokain', S.muenchen!);
      out[`S_rot_k${k}`] = r(S.rotterdam!, 1);
      out[`S_mue_k${k}`] = r(S.muenchen!, 1);
      out[`P_rot_k${k}`] = r(pr, 2);
      out[`P_mue_k${k}`] = r(pm, 2);
      out[`ratio_k${k}`] = r(pm / pr);
    }
    const f = npcRouteFlow(p, 'rotterdam', 'muenchen', 'kokain', targetStock(p, 'rotterdam', 'kokain'), targetStock(p, 'muenchen', 'kokain'), 1);
    Object.assign(out, { m_start: r(f.margin), theta: r(f.theta), f_start: r(f.f), q_start: r(f.q) });
    ex('EX-NPC-01', out);
  });

  it.skipIf(!('EX-NPC-04' in G))('EX-NPC-04 Rückbau k (F-NPC-04)', () => {
    const run = handoverRun(p, [...Array(35).fill(true), ...Array(14).fill(false)]);
    ex('EX-NPC-04', { day13: run[12]!, day14: run[13]!, day21: run[20]!, day35: run[34]!, day42: run[41]!, day49: run[48]! });
  });

  it('EX-PRF-01…03 Progression', () => {
    ex('EX-PRF-01', { L_2500: level(p, 2500), L_9999: level(p, 9999), XP_L10: xpForLevel(p, 10), XP_L20: xpForLevel(p, 20) });
    const c = controlProbability(p, 'rotterdam', 'muenchen', { kokain: 200 }, 10, p.vehicles.transporter!.hide, 4);
    const exp = G['EX-PRF-02']!;
    expect(xpHandel(p, 1126303)).toBe(exp.handel);
    expect(xpSchmuggel(p, distance(p, 'rotterdam', 'muenchen'), c.hv)).toBe(exp.schmuggel);
    const e3 = G['EX-PRF-03']!;
    expect(r(spread(p, 10))).toBeCloseTo(e3.spread_L10 as number, 6);
    expect(r(spread(p, 20))).toBeCloseTo(e3.spread_L20 as number, 6);
    expect(r(bonus(p, 'schmuggel_control_reduction', 10))).toBeCloseTo(e3.control_red_L10 as number, 6);
  });
});
