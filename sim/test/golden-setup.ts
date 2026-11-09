/**
 * Vitest-globalSetup: stellt die Sollwerte (EX-*) aus Agent 2s verify.py bereit, ohne Kopie in sim/.
 * Reihenfolge der Quellen:
 *   1. ENV SIM_GOLDEN (vom Aufrufer gesetzt)
 *   2. backend/test/golden/golden-vectors.json (Export von Agent 3, Feld "examples")
 *   3. Live-Export aus docs/game-design/tools/verify.py per python3
 * Fehlen alle Quellen, werden die Golden-Tests übersprungen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export default function setup() {
  if (process.env.SIM_GOLDEN) return;
  const repo = resolve(import.meta.dirname, '..', '..');
  const out = join(mkdtempSync(join(tmpdir(), 'sim-golden-')), 'golden.json');

  const backendJson = resolve(repo, 'backend/test/golden/golden-vectors.json');
  if (existsSync(backendJson)) {
    const data = JSON.parse(readFileSync(backendJson, 'utf8')) as { examples?: Record<string, unknown> };
    if (data.examples) {
      writeFileSync(out, JSON.stringify(data.examples));
      process.env.SIM_GOLDEN = out;
      return;
    }
  }

  const verify = resolve(repo, 'docs/game-design/tools/verify.py');
  if (!existsSync(verify)) return;
  const code =
    'import importlib.util,json,sys\n' +
    's=importlib.util.spec_from_file_location("verify",sys.argv[1]);v=importlib.util.module_from_spec(s);s.loader.exec_module(v)\n' +
    'json.dump(v.EXPECTED,open(sys.argv[2],"w"))\n';
  try {
    execFileSync('python3', ['-I', '-c', code, verify, out], { stdio: ['ignore', 'ignore', 'pipe'] });
    process.env.SIM_GOLDEN = out;
  } catch (e) {
    console.warn(`[golden] Export aus verify.py fehlgeschlagen: ${(e as Error).message}`);
  }
}
