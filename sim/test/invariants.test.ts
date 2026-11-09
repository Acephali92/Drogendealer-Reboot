/**
 * Invarianten (GAME_BALANCING.md §8, exploit-catalog.md):
 * I-1 Geldbilanz, I-3 kein Rund-Trip-Gewinn, I-4 keine negativen Bestände, I-5 Determinismus,
 * E-05 Order-Splitting bringt keinen Vorteil.
 */
import { describe, expect, it } from 'vitest';
import { marketPrice, markets, targetStock } from '../src/model/economy.js';
import { buyCost, maxOrder, sellRevenue } from '../src/model/trade.js';
import { loadParams, loadProposals, paramsAvailable } from '../src/params.js';
import { runSeed, type Scenario } from '../src/run.js';

const ready = paramsAvailable();

describe.skipIf(!ready)('Invarianten', () => {
  const p = ready ? loadParams().data : (undefined as never);
  const pr = loadProposals().data;

  it('I-3: Kauf + sofortiger Rückverkauf verliert in jedem Markt, für jede Menge und jedes Handel-Level', () => {
    for (const [c, g] of markets(p, 'earth')) {
      const S = targetStock(p, c, g);
      for (const L of [0, 10, 20]) {
        for (const f of [0.001, 0.05, 0.3, 0.9]) {
          const q = Math.max(1, Math.floor(maxOrder(p, S) * f));
          if (q > maxOrder(p, S)) continue;
          const buy = buyCost(p, c, g, { S, x: 0 }, q, L);
          const back = sellRevenue(p, c, g, { S: buy.S, x: 0 }, q, L);
          expect(back.revenue, `${c}/${g} q=${q} L=${L}`).toBeLessThan(buy.cost);
        }
      }
    }
  });

  it('E-05: n kleine Orders kosten mindestens so viel wie eine große (kein Splitting-Vorteil)', () => {
    for (const [c, g] of markets(p, 'earth')) {
      const S0 = targetStock(p, c, g);
      const q = Math.max(10, Math.floor(maxOrder(p, S0) * 0.3));
      const one = buyCost(p, c, g, { S: S0, x: 0 }, q).cost;
      let S = S0;
      let many = 0;
      for (let i = 0; i < 10; i++) {
        const r = buyCost(p, c, g, { S, x: 0 }, q / 10);
        many += r.cost;
        S = r.S;
      }
      // Rundung: jede Teilorder rundet auf → höchstens 10 ct teurer, nie billiger
      expect(many, `${c}/${g}`).toBeGreaterThanOrEqual(one - 1);
    }
  });

  it('Preise bleiben immer in [P_min, P_max]', () => {
    for (const [c, g] of markets(p, 'earth')) {
      const base = p.goods[g]!.base_price;
      for (const S of [1, 10, 1e3, 1e6, 1e9]) {
        for (const x of [-1, 0, 1]) {
          const P = marketPrice(p, c, g, S, x);
          expect(P).toBeGreaterThanOrEqual(base * p.economy.price_min_factor - 1e-9);
          expect(P).toBeLessThanOrEqual(base * p.economy.price_max_factor + 1e-9);
        }
      }
    }
  });

  const scenario: Scenario = {
    id: 'test',
    title: 'Invariantentest',
    days: 3,
    seeds: 1,
    background: 10,
    tracked: ['A', 'B', 'C', 'D', 'E'],
    options: { economyExt: true, npc: true, npcIntensity: 1, npcExt: true, safetyNet: true },
    checkpoints: [1, 3],
  };

  it('I-1 Geldbilanz und I-4 Bestände: keine Verletzung über 3 Tage mit allen Erweiterungen', () => {
    const r = runSeed(p, pr, scenario, 'inv-1');
    expect(r.invariantViolations).toEqual([]);
  });

  it('I-5 Determinismus: gleicher Seed → gleicher Endzustand; anderer Seed → anderer', () => {
    const a = runSeed(p, pr, scenario, 'det-1');
    const b = runSeed(p, pr, scenario, 'det-1');
    const c = runSeed(p, pr, scenario, 'det-2');
    expect(a.stateHash).toBe(b.stateHash);
    expect(a.tracked.map((t) => t.nw)).toEqual(b.tracked.map((t) => t.nw));
    expect(c.stateHash).not.toBe(a.stateHash);
  });
});
