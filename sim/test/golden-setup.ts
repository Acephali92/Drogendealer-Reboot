/**
 * Vitest-globalSetup: exportiert die Sollwerte (EXPECTED) aus Agent 2s verify.py als JSON,
 * ohne Kopie im Repo. Setzt SIM_GOLDEN für die Tests. Fehlt Python oder verify.py, bleibt
 * SIM_GOLDEN leer und die Golden-Tests werden übersprungen.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export default function setup() {
  if (process.env.SIM_GOLDEN) return;
  const repo = resolve(import.meta.dirname, '..', '..');
  const verify = resolve(repo, 'docs/game-design/tools/verify.py');
  if (!existsSync(verify)) return;
  const out = join(mkdtempSync(join(tmpdir(), 'sim-golden-')), 'golden.json');
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
