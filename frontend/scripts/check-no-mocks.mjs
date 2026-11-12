// Prüft, dass ein Production-Build keinen Mock-Code und keinen MSW-Service-Worker enthält
// (T-110: Mock-Default 'off' in Production). Aufruf nach `npm run build`.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const markers = ['dd-mock-state', 'mockServiceWorker', '[Mock-API]'];
const problems = [];

if (existsSync(join(dist, 'mockServiceWorker.js'))) problems.push('dist/mockServiceWorker.js vorhanden');
for (const f of readdirSync(join(dist, 'assets'))) {
  if (!f.endsWith('.js')) continue;
  const src = readFileSync(join(dist, 'assets', f), 'utf8');
  for (const m of markers) if (src.includes(m)) problems.push(`${f} enthält „${m}“`);
}

if (problems.length) {
  console.error('Production-Build enthält Mock-Code:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('OK: kein Mock-Code im Production-Build.');
