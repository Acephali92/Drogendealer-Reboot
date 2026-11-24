/**
 * Aggregation über Seeds und Markdown-Ausgabe für docs/balancing/SIMULATION_RESULTS.md.
 * Alle Geldwerte in der Ausgabe in Euro (Parameter rechnen in Cent).
 */
import type { ProfileId } from './bots/profiles.js';
import { PROFILES } from './bots/profiles.js';
import { gini, mean, quantile, type Scenario, type SeedResult, sfr } from './run.js';
import { FAUCETS, SINKS } from './world.js';

export interface HandoverSummary {
  /** je Seed: erster Tag mit k < 1 und Spielerzahl an diesem Tag */
  firstDrop: Array<{ seed: string; day: number | null; players: number | null; kEnd: number }>;
  /** Median je 30-Tage-Abschnitt */
  byMonth: Array<{ day: number; players: number; routeCompetition: number; marketActivity: number; peakOnline: number; metShare: number; k: number }>;
}

export interface Summary {
  scenario: Scenario;
  hypothesis: string;
  overrides: Record<string, number>;
  paramsSource: string;
  paramsSha256: string;
  proposalsSha256: string;
  seeds: string[];
  determinismHashes: string[];
  invariantViolations: number;
  profiles: Record<
    string,
    {
      nwAt: Record<string, { p10: number; median: number; p90: number }>;
      milestones: Record<string, { reachedShare: number; medianDay: number | null }>;
      tripsPerDay: number;
      bustRate: number;
      avgMargin: number;
      incomeEur: Record<string, number>;
      stuckDays: number;
      recoveries: number;
      lossShare: number;
      laundering: {
        washedEur: number;
        confiscatedCashEur: number;
        confiscatedGoodsEur: number;
        loans: number;
        loanTakenShare: number;
        loanOpenEndEur: number;
        whiteShareEnd: number;
        papersHits: number;
        levelFinanzenMedian: number;
      };
    }
  >;
  population: { giniMedian: number; topToMedianMedian: number };
  /** Kennzahlen über ALLE Spieler eines Profils (beobachtet + Hintergrund), höhere Stichprobe */
  allPlayers: Record<string, { n: number; lossShare: number; stuckDaysMean: number; loanShare: number; loansMean: number; confiscatedShare: number; nwMedianEur: number }>;
  market: { priceRatioMean: number; priceRatioMin: number; priceRatioMax: number; scarceShareMean: number; volumePerDayEur: number; topMarkets: Array<{ key: string; volumeEur: number; priceRatio: number; scarce: number }>; goodShare: Record<string, number> };
  handover?: HandoverSummary;
  money: { supplyEndMedianEur: number; supplyGrowthLast30Pct: number; sinkFaucetRatio: number; ledgerEur: Record<string, number>; events: number };
}

const eur = (ct: number) => Math.round(ct / 100);

const MILESTONES: Array<[string, (r: SeedResult['tracked'][number]) => number | null]> = [
  ['Kleinwagen', (r) => r.milestones['vehicle:kleinwagen'] ?? null],
  ['Transporter', (r) => r.milestones['vehicle:transporter'] ?? null],
  ['LKW', (r) => r.milestones['vehicle:lkw'] ?? null],
  ['NW ≥ 50 000 €', (r) => firstDay(r.nw, 5_000_000)],
  ['NW ≥ 500 000 €', (r) => firstDay(r.nw, 50_000_000)],
  ['NW ≥ 5 Mio. €', (r) => firstDay(r.nw, 500_000_000)],
  ['Finanzen L2 (W1)', (r) => r.milestones['finanzen:2'] ?? null],
  ['Finanzen L10 (W3)', (r) => r.milestones['finanzen:10'] ?? null],
  ['Finanzen L15 (W4)', (r) => r.milestones['finanzen:15'] ?? null],
];

function firstDay(series: number[], threshold: number): number | null {
  const i = series.findIndex((v) => v >= threshold);
  return i < 0 ? null : i + 1;
}

export function summarize(
  sc: Scenario,
  results: SeedResult[],
  meta: { hypothesis: string; overrides: Record<string, number>; paramsSource: string; paramsSha256: string; proposalsSha256: string },
): Summary {
  const profiles: Summary['profiles'] = {};
  for (const id of sc.tracked) {
    const rs = results.flatMap((r) => r.tracked.filter((t) => t.profile === id));
    const nwAt: Summary['profiles'][string]['nwAt'] = {};
    for (const d of sc.checkpoints) {
      const xs = rs.map((r) => r.nw[d - 1]!).filter((x) => x !== undefined);
      nwAt[`Tag ${d}`] = { p10: eur(quantile(xs, 0.1)), median: eur(quantile(xs, 0.5)), p90: eur(quantile(xs, 0.9)) };
    }
    const milestones: Summary['profiles'][string]['milestones'] = {};
    for (const [name, f] of MILESTONES) {
      const days = rs.map(f).filter((x): x is number => x !== null);
      milestones[name] = { reachedShare: days.length / rs.length, medianDay: days.length ? Math.round(quantile(days, 0.5) * 10) / 10 : null };
    }
    const income: Record<string, number> = {};
    for (const k of [...FAUCETS, ...SINKS]) income[k] = eur(mean(rs.map((r) => r.ledger[k])));
    const trips = mean(rs.map((r) => r.trips));
    profiles[id] = {
      nwAt,
      milestones,
      tripsPerDay: Math.round((trips / sc.days) * 100) / 100,
      bustRate: Math.round((mean(rs.map((r) => r.busts)) / Math.max(1, trips)) * 1000) / 1000,
      avgMargin: Math.round(mean(rs.map((r) => r.avgMargin)) * 1000) / 1000,
      incomeEur: income,
      stuckDays: Math.round(mean(rs.map((r) => r.stuckDays)) * 10) / 10,
      recoveries: Math.round(mean(rs.map((r) => r.recoveries)) * 100) / 100,
      lossShare: rs.filter((r) => r.nw.at(-1)! < 200_000).length / rs.length,
      laundering: {
        washedEur: eur(mean(rs.map((r) => r.washedCt))),
        confiscatedCashEur: eur(mean(rs.map((r) => r.confiscatedCashCt))),
        confiscatedGoodsEur: eur(mean(rs.map((r) => r.confiscatedGoodsCt))),
        loans: Math.round(mean(rs.map((r) => r.loans)) * 100) / 100,
        loanTakenShare: rs.filter((r) => r.loans > 0).length / rs.length,
        loanOpenEndEur: eur(mean(rs.map((r) => r.loanOpenEnd))),
        whiteShareEnd: Math.round(quantile(rs.map((r) => { const gross = r.nw.at(-1)! + r.loanOpenEnd; return gross > 0 ? r.bankEnd / gross : 0; }), 0.5) * 100) / 100,
        papersHits: Math.round(mean(rs.map((r) => r.papersHits)) * 100) / 100,
        levelFinanzenMedian: quantile(rs.map((r) => r.levelFinanzen), 0.5),
      },
    };
  }
  const ginis = results.map((r) => gini(r.population.nwFinal));
  const topMed = results.map((r) => Math.max(...r.population.nwFinal) / Math.max(1, quantile(r.population.nwFinal, 0.5)));
  const priceRatios = results.flatMap((r) => r.market.dailyPriceRatio);
  const perMarketKeys = Object.keys(results[0]!.market.perMarket);
  const topMarkets = perMarketKeys
    .map((key) => ({
      key,
      volumeEur: eur(mean(results.map((r) => r.market.perMarket[key]!.volumeCt)) / sc.days),
      priceRatio: Math.round(mean(results.map((r) => r.market.perMarket[key]!.priceRatio)) * 1000) / 1000,
      scarce: Math.round(mean(results.map((r) => r.market.perMarket[key]!.scarce)) * 1000) / 1000,
    }))
    .sort((a, b) => b.volumeEur - a.volumeEur)
    .slice(0, 8);
  // Umsatzanteil je Ware über alle Märkte (B-2: Warendominanz)
  const byGood: Record<string, number> = {};
  for (const r of results) for (const [key, m] of Object.entries(r.market.perMarket)) byGood[key.split('/')[1]!] = (byGood[key.split('/')[1]!] ?? 0) + m.volumeCt;
  const totalVol = Object.values(byGood).reduce((a, b) => a + b, 0);
  const goodShare = Object.fromEntries(
    Object.entries(byGood)
      .sort((a, b) => b[1] - a[1])
      .map(([g, v]) => [g, totalVol ? Math.round((v / totalVol) * 1000) / 1000 : 0]),
  );
  const ledger: Record<string, number> = {};
  for (const k of [...FAUCETS, ...SINKS]) ledger[k] = eur(mean(results.map((r) => r.ledger[k])));
  const supplyEnd = results.map((r) => r.moneySupply.at(-1)!);
  const growth = results.map((r) => {
    const n = r.moneySupply.length;
    const a = r.moneySupply[Math.max(0, n - 31)]!;
    return a ? (r.moneySupply[n - 1]! / a - 1) * 100 : 0;
  });
  let handover: HandoverSummary | undefined;
  if (results[0]!.handover.length) {
    const firstDrop = results.map((r) => {
      const d = r.handover.find((h) => h.k < 1);
      return { seed: r.seed, day: d?.day ?? null, players: d?.players ?? null, kEnd: r.handover.at(-1)!.k };
    });
    const byMonth: HandoverSummary['byMonth'] = [];
    for (let end = 30; end <= sc.days; end += 30) {
      const xs = results.flatMap((r) => r.handover.filter((h) => h.day > end - 30 && h.day <= end));
      const med = (f: (h: (typeof xs)[number]) => number) => Math.round(quantile(xs.map(f), 0.5) * 100) / 100;
      byMonth.push({ day: end, players: med((h) => h.players), routeCompetition: med((h) => h.routeCompetition), marketActivity: med((h) => h.marketActivity), peakOnline: med((h) => h.peakOnline), metShare: Math.round((xs.filter((h) => h.met).length / xs.length) * 100) / 100, k: med((h) => h.k) });
    }
    handover = { firstDrop, byMonth };
  }
  return {
    scenario: sc,
    ...meta,
    handover,
    seeds: results.map((r) => r.seed),
    determinismHashes: results.map((r) => r.stateHash),
    invariantViolations: results.reduce((a, r) => a + r.invariantViolations.length, 0),
    profiles,
    population: { giniMedian: Math.round(quantile(ginis, 0.5) * 1000) / 1000, topToMedianMedian: Math.round(quantile(topMed, 0.5) * 10) / 10 },
    allPlayers: allPlayerStats(results),
    market: {
      priceRatioMean: Math.round(mean(priceRatios) * 1000) / 1000,
      priceRatioMin: Math.round(Math.min(...priceRatios) * 1000) / 1000,
      priceRatioMax: Math.round(Math.max(...priceRatios) * 1000) / 1000,
      scarceShareMean: Math.round(mean(results.flatMap((r) => r.market.dailyScarce)) * 1000) / 1000,
      volumePerDayEur: eur(mean(results.flatMap((r) => r.market.dailyVolumeCt))),
      topMarkets,
      goodShare,
    },
    money: {
      supplyEndMedianEur: eur(quantile(supplyEnd, 0.5)),
      supplyGrowthLast30Pct: Math.round(quantile(growth, 0.5) * 10) / 10,
      sinkFaucetRatio: Math.round(sfr(sumLedgers(results)) * 1000) / 1000,
      ledgerEur: ledger,
      events: Math.round(mean(results.map((r) => r.events))),
    },
  };
}

function allPlayerStats(results: SeedResult[]): Summary['allPlayers'] {
  const by: Record<string, { nw: number[]; stuck: number[]; loans: number[]; conf: number[] }> = {};
  for (const r of results) {
    const pop = r.population;
    pop.profiles.forEach((id, i) => {
      const b = (by[id] ??= { nw: [], stuck: [], loans: [], conf: [] });
      b.nw.push(pop.nwFinal[i]!);
      b.stuck.push(pop.stuckDays[i]!);
      b.loans.push(pop.loans[i]!);
      b.conf.push(pop.confiscations[i]!);
    });
  }
  const out: Summary['allPlayers'] = {};
  for (const [id, b] of Object.entries(by)) {
    out[id] = {
      n: b.nw.length,
      lossShare: Math.round((b.nw.filter((x) => x < 200_000).length / b.nw.length) * 1000) / 1000,
      stuckDaysMean: Math.round(mean(b.stuck) * 10) / 10,
      loanShare: Math.round((b.loans.filter((x) => x > 0).length / b.nw.length) * 1000) / 1000,
      loansMean: Math.round(mean(b.loans) * 100) / 100,
      confiscatedShare: Math.round((b.conf.filter((x) => x > 0).length / b.nw.length) * 1000) / 1000,
      nwMedianEur: eur(quantile(b.nw, 0.5)),
    };
  }
  return out;
}

function sumLedgers(results: SeedResult[]) {
  const acc = { ...results[0]!.ledger };
  for (const k of Object.keys(acc) as Array<keyof typeof acc>) acc[k] = results.reduce((a, r) => a + r.ledger[k], 0);
  return acc;
}

const fmt = (n: number) => n.toLocaleString('de-DE');

export function toMarkdown(s: Summary): string {
  const L: string[] = [];
  const sc = s.scenario;
  L.push(`### ${sc.id} – ${sc.title}`);
  L.push('');
  L.push(`- **Hypothese:** ${s.hypothesis}`);
  L.push(`- **Setup:** ${sc.background} Hintergrundspieler + je 1 beobachteter Bot A–E, ${sc.days} Tage, ${s.seeds.length} Seeds. Erweiterungen: Wirtschaft ${sc.options.economyExt ? 'an' : 'aus'}, NPC-Händler F-NPC-01 ${sc.options.npc ? `an (k = ${sc.options.npcIntensity})` : 'aus'}, Kundenbindung/Polizeidruck ${sc.options.npcExt ? 'an' : 'aus'}, Sicherheitsnetz ${sc.options.safetyNet ? 'an' : 'aus'}, Beschlagnahme bei Kontrolle ${Math.round((sc.options.confiscationShare ?? 1) * 100)} % der Ladung, Organisationskosten F-PRG-01 ${sc.options.wealthSink ? 'an' : 'aus'}${sc.options.adr023 ? `, **ADR-023** (Totalbeschlagnahme Ware + Bargeld): Wäsche ${sc.options.laundering ? 'an' : 'aus'}, Kredithai ${sc.options.loanShark ? 'an' : 'aus'}` : ''}.`);
  if (Object.keys(s.overrides).length) L.push(`- **Geänderter Parameter:** ${Object.entries(s.overrides).map(([k, v]) => `\`${k}\` = ${v}`).join(', ')}`);
  L.push(`- **Parameter:** \`${s.paramsSource}\` (SHA-256 \`${s.paramsSha256.slice(0, 12)}…\`), Vorschläge \`sim/proposals.toml\` (\`${s.proposalsSha256.slice(0, 12)}…\`). Invariantenverletzungen: **${s.invariantViolations}**.`);
  L.push('');
  L.push('**Nettovermögen [gemessen]** (Median, in Klammern P10–P90, Euro)');
  L.push('');
  const cps = Object.keys(s.profiles[sc.tracked[0]!]!.nwAt);
  L.push(`| Profil | ${cps.join(' | ')} |`);
  L.push(`|---|${cps.map(() => '---:').join('|')}|`);
  for (const id of sc.tracked) {
    const pr = s.profiles[id]!;
    L.push(`| ${id} ${PROFILES[id as ProfileId].name} | ${cps.map((c) => `${fmt(pr.nwAt[c]!.median)} (${fmt(pr.nwAt[c]!.p10)}–${fmt(pr.nwAt[c]!.p90)})`).join(' | ')} |`);
  }
  L.push('');
  L.push('**Meilensteine [gemessen]** (Anteil der Seeds, die ihn erreichen · Median-Tag)');
  L.push('');
  const ms = Object.keys(s.profiles[sc.tracked[0]!]!.milestones);
  L.push(`| Profil | ${ms.join(' | ')} |`);
  L.push(`|---|${ms.map(() => '---').join('|')}|`);
  for (const id of sc.tracked) {
    const pr = s.profiles[id]!;
    L.push(`| ${id} | ${ms.map((m) => { const x = pr.milestones[m]!; return x.reachedShare ? `${Math.round(x.reachedShare * 100)} % · Tag ${x.medianDay}` : '–'; }).join(' | ')} |`);
  }
  L.push('');
  L.push('**Verhalten und Risiko [gemessen]** (Mittel je beobachtetem Bot)');
  L.push('');
  L.push('| Profil | Fahrten/Tag | Kontrollquote je Fahrt | Ø Marge je Handel | Einnahmen Verkauf € | Einkauf € | Reisekosten € | Strafen, Bestechung, Tilgung, Organisation, Beschlagnahme, Wäsche € | Sackgassen-Tage | Neustarts | Ende < Startkapital |');
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const id of sc.tracked) {
    const pr = s.profiles[id]!;
    const i = pr.incomeEur;
    L.push(`| ${id} | ${pr.tripsPerDay} | ${(pr.bustRate * 100).toFixed(1)} % | ${(pr.avgMargin * 100).toFixed(0)} % | ${fmt(i.sale!)} | ${fmt(i.purchase!)} | ${fmt(i.fuel! + i.train!)} | ${fmt(i.fine! + i.bribe! + i.debtRepay! + i.orgCost! + i.confiscation! + i.washFee! + i.papers!)} | ${pr.stuckDays} | ${pr.recoveries} | ${Math.round(pr.lossShare * 100)} % |`);
  }
  L.push('');
  if (sc.options.adr023) {
    L.push('**Wäsche, Beschlagnahme, Kredithai [gemessen]** (Mittel je beobachtetem Bot; Weißgeld-Anteil = Median Konto ÷ Bruttovermögen am Ende)');
    L.push('');
    L.push('| Profil | gewaschen € | Waschgebühren € | beschlagnahmtes Bargeld € | beschlagnahmte Ware (P_base) € | Kredite | Anteil mit Kredit | offene Kreditschuld Ende € | Weißgeld-Anteil | Finanzen-Level (Median) | Papers |');
    L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const id of sc.tracked) {
      const x = s.profiles[id]!.laundering;
      L.push(`| ${id} | ${fmt(x.washedEur)} | ${fmt(s.profiles[id]!.incomeEur.washFee!)} | ${fmt(x.confiscatedCashEur)} | ${fmt(x.confiscatedGoodsEur)} | ${x.loans} | ${Math.round(x.loanTakenShare * 100)} % | ${fmt(x.loanOpenEndEur)} | ${Math.round(x.whiteShareEnd * 100)} % | ${x.levelFinanzenMedian} | ${x.papersHits} |`);
    }
    L.push('');
  }
  L.push('**Alle Spieler je Profil [gemessen]** (beobachtete + Hintergrund-Bots, Stand letzter Tag; Leitkennzahl für den Sackgassen-Nachweis)');
  L.push('');
  L.push('| Profil | n | unter Startkapital | Ø Sackgassen-Tage | mit Beschlagnahme | mit Kredit | Ø Kredite | NW Median € |');
  L.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const id of ['A', 'B', 'C', 'D', 'E']) {
    const a = s.allPlayers[id];
    if (!a) continue;
    L.push(`| ${id} ${PROFILES[id as ProfileId].name} | ${a.n} | **${Math.round(a.lossShare * 100)} %** | ${a.stuckDaysMean} | ${Math.round(a.confiscatedShare * 100)} % | ${Math.round(a.loanShare * 100)} % | ${a.loansMean} | ${fmt(a.nwMedianEur)} |`);
  }
  L.push('');
  L.push('**Markt und Geldmenge [gemessen]**');
  L.push('');
  L.push(`- Preisniveau P/P* (Tagesmittel über alle Märkte): Ø ${s.market.priceRatioMean}, Spanne ${s.market.priceRatioMin}–${s.market.priceRatioMax}. Anteil knapper Markt-Ticks: ${(s.market.scarceShareMean * 100).toFixed(1)} %. Marktereignisse je Lauf: ${s.money.events}.`);
  L.push(`- Handelsvolumen: ${fmt(s.market.volumePerDayEur)} € pro Tag. Geldmenge am Ende (Median): ${fmt(s.money.supplyEndMedianEur)} €, Wachstum in den letzten 30 Tagen: ${s.money.supplyGrowthLast30Pct} %. Senken/Quellen (SFR): ${s.money.sinkFaucetRatio}.`);
  L.push(`- Ungleichheit am Ende (alle Spieler): Gini ${s.population.giniMedian}, reichster Spieler ÷ Median ${s.population.topToMedianMedian}.`);
  if (s.handover) {
    L.push('');
    L.push('**Rückbau der NPC-Händler F-NPC-04 [gemessen]** (Median je 30-Tage-Abschnitt; Ziel-Verfügbarkeit PvP nicht simuliert → als erfüllt angenommen)');
    L.push('');
    L.push('| bis Tag | Spieler | Routen-Konkurrenz | Marktaktivität | Spitzen-Online | Anteil erfüllter Tage | k |');
    L.push('|---:|---:|---:|---:|---:|---:|---:|');
    for (const m of s.handover.byMonth) L.push(`| ${m.day} | ${m.players} | ${m.routeCompetition} | ${m.marketActivity} | ${m.peakOnline} | ${Math.round(m.metShare * 100)} % | ${m.k} |`);
    L.push('');
    L.push(`Erster Rückgang von k je Seed: ${s.handover.firstDrop.map((f) => (f.day ? `Tag ${f.day} bei ${f.players} Spielern` : 'kein Rückgang')).join('; ')}. k am Ende: ${s.handover.firstDrop.map((f) => f.kEnd).join(', ')}.`);
    L.push('');
  }
  L.push(`- Umsatzanteil je Ware: ${Object.entries(s.market.goodShare).map(([g, v]) => `${g} ${(v * 100).toFixed(0)} %`).join(', ')}.`);
  L.push(`- Umsatzstärkste Märkte: ${s.market.topMarkets.slice(0, 5).map((m) => `\`${m.key}\` ${fmt(m.volumeEur)} €/Tag (P/P* ${m.priceRatio}, knapp ${(m.scarce * 100).toFixed(0)} %)`).join('; ')}.`);
  L.push('');
  return L.join('\n');
}
