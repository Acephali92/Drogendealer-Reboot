/**
 * Erzeugt das Parameterverzeichnis (docs/balancing/BALANCING_PARAMETERS.md, Abschnitt 2–4)
 * aus parameters.toml (Werte, [bounds]) + sim/parameter-meta.toml (Beschreibung, Begründung …)
 * + sim/proposals.toml (Vorschläge). So bleiben Werte nur an einer Stelle.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { getPath, type LoadedToml, type Params, type Proposals, SIM_ROOT } from './params.js';

interface Meta {
  desc: string;
  unit: string;
  min?: number;
  max?: number;
  scope: string;
  deps: string;
  why: string;
  owner: string;
  interval: string;
  changed: string;
}

const fmt = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: 6 }) : Array.isArray(v) ? v.join(', ') : String(v));

export function registryMarkdown(params: LoadedToml<Params>, proposals: LoadedToml<Proposals>): string {
  const meta = parse(readFileSync(resolve(SIM_ROOT, 'parameter-meta.toml'), 'utf8')) as unknown as Record<string, Meta>;
  const p = params.data;
  const L: string[] = [];
  L.push(`<!-- generiert mit \`npm run sim -- registry\` aus parameters.toml (SHA-256 ${params.sha256.slice(0, 12)}…, Version ${p.meta.version}) -->`);
  L.push('');
  L.push('### 2.1 Globale Wirtschafts- und Progressionsparameter');
  L.push('');
  L.push('| Schlüssel | Beschreibung | Wert | Min | Max | Einheit | Einflussbereich | Abhängigkeiten | Aktualisierung | Begründung | Eigentümer | Letzte Änderung |');
  L.push('|---|---|---:|---:|---:|---|---|---|---|---|---|---|');
  for (const [key, m] of Object.entries(meta)) {
    const v = getPath(p, key);
    const b = p.bounds?.[key];
    const lo = b ? b[0] : m.min;
    const hi = b ? b[1] : m.max;
    L.push(`| \`${key}\` | ${m.desc} | ${v === undefined ? '**fehlt**' : fmt(v)} | ${lo ?? '–'} | ${hi ?? '–'} | ${m.unit} | ${m.scope} | ${m.deps} | ${m.interval} | ${m.why} | ${m.owner} | ${m.changed} |`);
  }
  L.push('');
  L.push('### 2.2 Waren (`goods.*`, Inhalt)');
  L.push('');
  L.push('| Schlüssel | Welt | P_base (ct) | Verbrauch je 1 000 Einw. und Tick | Volatilität σ | Volumen | Verderb/Tick | Heat-Faktor |');
  L.push('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const [k, g] of Object.entries(p.goods)) L.push(`| \`${k}\` | ${g.realm} | ${fmt(g.base_price)} | ${fmt(g.consumption)} | ${fmt(g.volatility)} | ${g.volume} | ${fmt(g.spoil_rate)} | ${fmt(g.heat)} |`);
  L.push('');
  L.push('Grenzen: P_base > 0; Gleichgewichtspreise aller Märkte in [P_min, P_max] (INV-02); Volatilität ≤ 0,05 (Vorschlag Agent 5, damit P/P* im Korridor 0,85–1,15 bleibt).');
  L.push('');
  L.push('### 2.3 Städte (`city.*`, Inhalt)');
  L.push('');
  L.push('| Schlüssel | Bevölkerung (Tsd.) | Wohlstand W | Polizei | Treibstoff ct/l | Angebot m_s (≠ 1) | Nachfrage m_d (≠ 1) |');
  L.push('|---|---:|---:|---:|---:|---|---|');
  for (const [k, c] of Object.entries(p.city)) {
    const kv = (o?: Record<string, number>) => Object.entries(o ?? {}).map(([g, x]) => `${g} ${fmt(x)}`).join(', ') || '–';
    L.push(`| \`${k}\` | ${fmt(c.pop)} | ${fmt(c.wealth)} | ${fmt(c.police)} | ${c.fuel_price} | ${kv(c.supply)} | ${kv(c.demand)} |`);
  }
  L.push('');
  L.push('### 2.4 Marktereignisse (`events.*`)');
  L.push('');
  L.push('| Schlüssel | Wahrscheinlichkeit/Tick/Markt | Dauer (Ticks) | Bestandsschock | Angebot × | Nachfrage × |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const [k, e] of Object.entries(p.events)) L.push(`| \`${k}\` | ${fmt(e.probability)} | ${e.duration} | ${fmt(e.stock_shock)} | ${fmt(e.supply_mult)} | ${fmt(e.demand_mult)} |`);
  L.push('');
  L.push('### 2.5 NPCs (`npc.*`, Regel F-NPC-01…04, Agent 2 / fachlich Agent 5)');
  L.push('');
  L.push('| Schlüssel | Wert | Grenzen ([bounds]) |');
  L.push('|---|---:|---|');
  for (const [k, v] of Object.entries((p.npc as Record<string, unknown>) ?? {})) {
    const b = p.bounds?.[`npc.${k}`];
    L.push(`| \`npc.${k}\` | ${fmt(v)} | ${b ? `[${b[0]}; ${b[1]}]` : '–'} |`);
  }
  L.push('');
  L.push(`### 2.6 Vorschläge von Agent 5 (\`sim/proposals.toml\`, SHA-256 ${proposals.sha256.slice(0, 12)}…, Status: ${proposals.data.meta.status})`);
  L.push('');
  L.push('| Schlüssel | Vorschlag |');
  L.push('|---|---:|');
  for (const sec of ['economy_ext', 'npc_ext', 'safety_net'] as const) {
    for (const [k, v] of Object.entries(proposals.data[sec])) L.push(`| \`${sec}.${k}\` | ${fmt(v)} |`);
  }
  L.push('');
  return L.join('\n');
}
