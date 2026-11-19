/**
 * B-11 statische Analyse: NPC-Gleichgewicht (F-NPC-01 + F-ECO-04) je Variante.
 * Kennzahlen: Top-Route Kokain Rotterdam→München (EX-NPC-01) und Routenmargen der
 * Waren mit Heat ≤ 1 (Profil A) nach Spread.
 */
import { loadParams, withOverride, type Params } from './params.js';
import { marketPrice, markets, targetStock } from './model/economy.js';
import { npcTraderFlows } from './model/npc.js';
import { stockStep } from './model/economy.js';
import { spread } from './model/trade.js';

const base = loadParams().data;
const variants: Array<[string, Params, number]> = [
  ['ohne NPC (k = 0)', base, 0],
  ['k = 1 (b11-npc)', base, 1],
  ['k = 0,5 (b11-k05)', base, 0.5],
  ['η = 0,25 (b11-eta025)', withOverride(base, 'npc.trader_intensity', 0.25), 1],
  ['θ₀ = 0,30 (b11-theta)', withOverride(base, 'npc.trader_threshold_base', 0.3), 1],
  ['θ₀ = 0,45 (b11-theta45)', withOverride(base, 'npc.trader_threshold_base', 0.45), 1],
  ['θ₀ = 0,30, k = 0,5 (b11-theta-k05)', withOverride(base, 'npc.trader_threshold_base', 0.3), 0.5],
];
const goods = [...new Set(markets(base, 'earth').map(([, g]) => g))];
const cities = [...new Set(markets(base, 'earth').map(([c]) => c))];
const s = spread(base, 0);
console.log('| Variante | Top-Route P_Mü/P_Rot | Waren Heat ≤ 1: Routen mit Marge ≥ 20 % | ≥ 40 % | beste Marge | Ø Top-5-Marge |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const [name, p, k] of variants) {
  const S: Record<string, Record<string, number>> = {};
  for (const g of goods) {
    // wie npcEquilibrium (verify.py), aber nur über Städte, die die Ware führen
    let st: Record<string, number> = Object.fromEntries(markets(p, 'earth').filter(([, g2]) => g2 === g).map(([c]) => [c, targetStock(p, c, g)]));
    if (k > 0)
      for (let i = 0; i < 3000; i++) {
        const fl = npcTraderFlows(p, g, st, k);
        st = Object.fromEntries(Object.entries(fl).map(([c, v]) => [c, stockStep(p, v, targetStock(p, c, g))]));
      }
    S[g] = st;
  }
  const ratio = marketPrice(p, 'muenchen', 'kokain', S.kokain!.muenchen!) / marketPrice(p, 'rotterdam', 'kokain', S.kokain!.rotterdam!);
  const margins: number[] = [];
  for (const g of goods) {
    if (p.goods[g]!.heat > 1) continue;
    for (const a of cities)
      for (const b of cities) {
        if (a === b || S[g]![a] === undefined || S[g]![b] === undefined) continue;
        const pa = marketPrice(p, a, g, S[g]![a]!) * (1 + s / 2);
        const pb = marketPrice(p, b, g, S[g]![b]!) * (1 - s / 2);
        margins.push(pb / pa - 1);
      }
  }
  margins.sort((x, y) => y - x);
  const share = (t: number) => ((100 * margins.filter((m) => m >= t).length) / margins.length).toFixed(1) + ' %';
  const top5 = margins.slice(0, 5).reduce((a2, b2) => a2 + b2, 0) / 5;
  console.log(`| ${name} | ${ratio.toFixed(2)} | ${share(0.2)} | ${share(0.4)} | ${(100 * margins[0]!).toFixed(0)} % | ${(100 * top5).toFixed(0)} % |`);
}
