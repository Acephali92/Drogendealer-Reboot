/**
 * Kommandozeile der Balancing-Simulation.
 *
 *   npm run sim -- list
 *   npm run sim -- run base ext --params ../docs/game-design/parameters.toml [--seeds 4] [--days 30] [--set economy.elasticity=0.4]
 *   npm run sim -- registry            # Tabelle für docs/balancing/BALANCING_PARAMETERS.md
 *
 * Ergebnisse: sim/out/<szenario>/summary.json und summary.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { loadParams, loadProposals, SIM_ROOT, withOverride } from './params.js';
import { registryMarkdown } from './registry.js';
import { summarize, toMarkdown } from './report.js';
import type { Scenario, SeedResult } from './run.js';
import { EXPERIMENTS } from './scenarios.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  });
  return out;
}

async function runParallel(params: unknown, proposals: unknown, scenario: Scenario): Promise<SeedResult[]> {
  const seeds = Array.from({ length: scenario.seeds }, (_, i) => `${scenario.id}-${i + 1}`);
  const results: SeedResult[] = new Array(seeds.length);
  const threads = Math.max(1, Math.min(cpus().length, seeds.length));
  let next = 0;
  const workerUrl = new URL('./worker.ts', import.meta.url);
  async function lane() {
    while (next < seeds.length) {
      const i = next++;
      results[i] = await new Promise<SeedResult>((res, rej) => {
        const w = new Worker(workerUrl, { workerData: { params, proposals, scenario, seed: seeds[i] }, execArgv: ['--import', 'tsx'] });
        w.once('message', res);
        w.once('error', rej);
      });
      process.stderr.write('.');
    }
  }
  await Promise.all(Array.from({ length: threads }, lane));
  process.stderr.write('\n');
  return results;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'list' || !cmd) {
    for (const [id, e] of Object.entries(EXPERIMENTS)) console.log(`${id.padEnd(14)} ${e.scenario.days} d × ${e.scenario.seeds} Seeds  ${e.scenario.title}`);
    return;
  }
  const loaded = loadParams(arg('params'));
  const proposals = loadProposals(arg('proposals'));
  if (cmd === 'registry') {
    console.log(registryMarkdown(loaded, proposals));
    return;
  }
  if (cmd !== 'run') throw new Error(`Unbekannter Befehl: ${cmd}`);
  const ids = process.argv.slice(3).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--'));
  const targets = ids.includes('all') ? Object.keys(EXPERIMENTS) : ids;
  for (const id of targets) {
    const exp = EXPERIMENTS[id];
    if (!exp) throw new Error(`Unbekanntes Szenario: ${id}`);
    const scenario: Scenario = structuredClone(exp.scenario);
    if (arg('seeds')) scenario.seeds = Number(arg('seeds'));
    if (arg('days')) {
      scenario.days = Number(arg('days'));
      scenario.checkpoints = scenario.checkpoints.filter((d) => d <= scenario.days);
      if (!scenario.checkpoints.includes(scenario.days)) scenario.checkpoints.push(scenario.days);
    }
    const overrides: Record<string, number> = { ...(exp.overrides ?? {}) };
    for (const kv of args('set')) {
      const [k, v] = kv.split('=');
      overrides[k!] = Number(v);
    }
    let params = loaded.data;
    for (const [k, v] of Object.entries(overrides)) params = withOverride(params, k, v);
    const t0 = Date.now();
    process.stderr.write(`${id}: ${scenario.days} Tage × ${scenario.seeds} Seeds `);
    const results = await runParallel(params, proposals.data, scenario);
    const summary = summarize(scenario, results, {
      hypothesis: exp.hypothesis,
      overrides,
      paramsSource: arg('params-label') ?? loaded.path,
      paramsSha256: loaded.sha256,
      proposalsSha256: proposals.sha256,
    });
    const dir = resolve(arg('out') ?? resolve(SIM_ROOT, 'out'), id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'summary.json'), JSON.stringify(summary, null, 2));
    writeFileSync(resolve(dir, 'summary.md'), toMarkdown(summary));
    process.stderr.write(`${id}: fertig in ${Math.round((Date.now() - t0) / 1000)} s → ${dir}\n`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
