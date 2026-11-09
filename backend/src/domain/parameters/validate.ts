/**
 * Validation of game parameters: schema (types, ranges, unknown keys) plus cross-references the
 * schema alone cannot express. Pure function – the I/O wrapper is src/config/parameters.ts.
 */
import { gameParametersSchema, type GameParameters } from './schema.js';

export interface ParameterIssue {
  /** Dotted path in the TOML file, e.g. "goods.kokain.base_price". */
  readonly path: string;
  readonly message: string;
}

export type ParameterValidation =
  | { readonly ok: true; readonly params: GameParameters }
  | { readonly ok: false; readonly issues: readonly ParameterIssue[] };

export class InvalidGameParametersError extends Error {
  constructor(
    public readonly issues: readonly ParameterIssue[],
    source = 'game parameters',
  ) {
    super(`Invalid ${source}:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`);
    this.name = 'InvalidGameParametersError';
  }
}

const MINUTES_PER_DAY = 1440;

function pairKeys(names: readonly string[]): string[] {
  const sorted = [...names].sort();
  const keys: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) keys.push(`${sorted[i]}-${sorted[j]}`);
  }
  return keys;
}

function checkDistances(
  section: string,
  table: Readonly<Record<string, number>>,
  places: readonly string[],
  issues: ParameterIssue[],
): void {
  const known = new Set(places);
  for (const key of Object.keys(table)) {
    const [a, b] = key.split('-') as [string, string];
    if (!known.has(a) || !known.has(b)) {
      issues.push({ path: `${section}.${key}`, message: `unknown place in "${key}"` });
    } else if (a >= b) {
      issues.push({
        path: `${section}.${key}`,
        message: 'key must be sorted alphabetically ("a-b" with a < b)',
      });
    }
  }
  for (const expected of pairKeys(places)) {
    if (!(expected in table)) issues.push({ path: `${section}.${expected}`, message: 'distance missing' });
  }
}

function checkGoodRefs(
  path: string,
  map: Readonly<Record<string, number>>,
  goods: ReadonlySet<string>,
  issues: ParameterIssue[],
): void {
  for (const key of Object.keys(map)) {
    if (!goods.has(key)) issues.push({ path: `${path}.${key}`, message: `unknown good "${key}"` });
  }
}

/** Cross-reference checks on already schema-valid parameters. */
export function crossCheck(p: GameParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const goods = new Set(Object.keys(p.goods));

  if (p.meta.tick_minutes * p.meta.ticks_per_day !== MINUTES_PER_DAY) {
    issues.push({ path: 'meta', message: `tick_minutes × ticks_per_day must be ${MINUTES_PER_DAY}` });
  }

  for (const [key, c] of Object.entries(p.city)) {
    checkGoodRefs(`city.${key}.supply`, c.supply, goods, issues);
    checkGoodRefs(`city.${key}.demand`, c.demand, goods, issues);
  }
  for (const [key, loc] of Object.entries(p.space_location)) {
    checkGoodRefs(`space_location.${key}.supply`, loc.supply, goods, issues);
    checkGoodRefs(`space_location.${key}.demand`, loc.demand, goods, issues);
  }
  checkDistances('distances', p.distances, Object.keys(p.city), issues);
  checkDistances('space_distances', p.space_distances, Object.keys(p.space_location), issues);

  const fields = new Set(p.professions.fields);
  for (const [key, u] of Object.entries(p.unlocks)) {
    if (u.field !== undefined && !fields.has(u.field)) {
      issues.push({ path: `unlocks.${key}.field`, message: `unknown profession field "${u.field}"` });
    }
  }
  for (const [key, b] of Object.entries(p.businesses)) {
    for (const g of b.produces ?? []) {
      if (!goods.has(g)) issues.push({ path: `businesses.${key}.produces`, message: `unknown good "${g}"` });
    }
  }

  const ranks = new Set(p.clans.ranks);
  for (const field of [
    'election_voter_min_rank',
    'election_candidate_min_rank',
    'no_confidence_min_rank',
  ] as const) {
    if (!ranks.has(p.clans[field])) {
      issues.push({ path: `clans.${field}`, message: `unknown rank "${p.clans[field]}"` });
    }
  }
  if (p.clans.no_confidence_quorum_num > p.clans.no_confidence_quorum_den) {
    issues.push({ path: 'clans.no_confidence_quorum_num', message: 'quorum must not exceed 1' });
  }

  if (!(p.npc.k_min <= p.npc.k_start && p.npc.k_start <= p.npc.k_max)) {
    issues.push({ path: 'npc.k_start', message: 'k_min ≤ k_start ≤ k_max violated' });
  }
  if (p.combat.win_chance_min > p.combat.win_chance_max) {
    issues.push({ path: 'combat.win_chance_min', message: 'must not exceed win_chance_max' });
  }
  if (p.travel.bribe_success_min > p.travel.bribe_success_max) {
    issues.push({ path: 'travel.bribe_success_min', message: 'must not exceed bribe_success_max' });
  }
  if (p.economy.price_min_factor > p.economy.price_max_factor) {
    issues.push({ path: 'economy.price_min_factor', message: 'must not exceed price_max_factor' });
  }
  if (p.real_estate.roi_target_min_days > p.real_estate.roi_target_max_days) {
    issues.push({ path: 'real_estate.roi_target_min_days', message: 'must not exceed roi_target_max_days' });
  }

  // [bounds]: every referenced parameter exists, is numeric and lies within [min, max].
  const sections = p as unknown as Record<string, Record<string, unknown> | undefined>;
  for (const [ref, [min, max]] of Object.entries(p.bounds)) {
    const [section, key] = ref.split('.') as [string, string];
    const value = sections[section]?.[key];
    if (min > max) {
      issues.push({ path: `bounds.${ref}`, message: `min ${min} is greater than max ${max}` });
    } else if (typeof value !== 'number' && typeof value !== 'bigint') {
      issues.push({ path: `bounds.${ref}`, message: 'references an unknown or non-numeric parameter' });
    } else if (Number(value) < min || Number(value) > max) {
      issues.push({ path: ref, message: `value ${Number(value)} outside bounds [${min}, ${max}]` });
    }
  }

  return issues;
}

/** Validates raw TOML data (integers as bigint) against schema and cross-references. */
export function validateGameParameters(raw: unknown): ParameterValidation {
  const parsed = gameParametersSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
    };
  }
  const issues = crossCheck(parsed.data);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, params: parsed.data };
}
