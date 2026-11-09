import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parse } from 'smol-toml';
import { $Enums } from '@prisma/client';
import {
  CLAN_RANKS,
  IMAGE_CATEGORIES,
  validateGameParameters,
  type GameParameters,
} from '../../src/domain/index.js';
import {
  DEFAULT_GAME_PARAMETERS_PATH,
  loadGameParameters,
  parseGameParameters,
} from '../../src/config/parameters.js';
import { golden, PARAMETERS_TOML } from './golden.js';

/** Raw TOML data as the loader sees it (integers as BigInt), freshly parsed for mutation. */
type Raw = Record<string, Record<string, unknown>>;
const raw = (): Raw => parse(PARAMETERS_TOML, { integersAsBigInt: true }) as unknown as Raw;
const section = (r: Raw, ...path: string[]) =>
  path.reduce<Record<string, unknown>>((obj, key) => obj[key] as Record<string, unknown>, r);

function issuesFor(mutate: (r: Raw) => void) {
  const r = raw();
  mutate(r);
  const result = validateGameParameters(r);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues;
}

describe('the real parameters.toml', () => {
  it('passes schema and cross-reference validation', () => {
    const result = validateGameParameters(raw());
    if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
    expect(result.params.meta.tick_minutes * result.params.meta.ticks_per_day).toBe(1440);
  });

  it('is the file the golden vectors were generated from', () => {
    const hash = createHash('sha256').update(PARAMETERS_TOML, 'utf8').digest('hex');
    expect(hash, 'regenerate: python3 -I backend/scripts/export-golden-vectors.py').toBe(
      golden.sources['parameters.toml'],
    );
  });

  it('is parsed exactly like Python tomllib (parser conformance)', () => {
    expect(parse(PARAMETERS_TOML)).toEqual(golden.parameters);
  });

  it('maps money to bigint cents and other numbers to number', () => {
    const p: GameParameters = parseGameParameters(PARAMETERS_TOML);
    expect(p.player.start_cash_black).toBe(200_000n);
    expect(p.goods.gras?.base_price).toBe(1_000n);
    expect(p.city.berlin?.fuel_price).toBe(185n);
    expect(typeof p.meta.tick_minutes).toBe('number');
    expect(p.economy.min_stock).toBe(1);
    expect(p.city.berlin?.name).toBe('Pleitenberg'); // display name, the key stays technical (ADR-013)
  });

  it('is deeply frozen after loading', () => {
    const p = loadGameParameters();
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.goods.gras)).toBe(true);
    expect(DEFAULT_GAME_PARAMETERS_PATH.endsWith('docs/game-design/parameters.toml')).toBe(true);
  });
});

describe('invalid parameters are rejected with a precise path', () => {
  it.each([
    [
      'money written as float',
      (r: Raw) => (section(r, 'goods', 'gras').base_price = 1000.5),
      'goods.gras.base_price',
    ],
    ['negative money', (r: Raw) => (section(r, 'player').start_cash_black = -1n), 'player.start_cash_black'],
    ['integer written as float', (r: Raw) => (section(r, 'meta').tick_minutes = 10.5), 'meta.tick_minutes'],
    [
      'probability above 1',
      (r: Raw) => (section(r, 'events', 'razzia').probability = 1.5),
      'events.razzia.probability',
    ],
    ['unknown key (typo)', (r: Raw) => (section(r, 'goods', 'gras').bse_price = 1n), 'goods.gras'],
    ['missing key', (r: Raw) => delete section(r, 'combat').alpha, 'combat.alpha'],
    ['unknown realm', (r: Raw) => (section(r, 'goods', 'gras').realm = 'hell'), 'goods.gras.realm'],
    ['value outside [bounds]', (r: Raw) => (section(r, 'economy').elasticity = 0.1), 'economy.elasticity'],
    [
      'unknown good in city supply',
      (r: Raw) => (section(r, 'city', 'berlin', 'supply').zucker = 1.2),
      'city.berlin.supply.zucker',
    ],
    [
      'missing distance',
      (r: Raw) => delete section(r, 'distances')['amsterdam-berlin'],
      'distances.amsterdam-berlin',
    ],
    [
      'unsorted distance key',
      (r: Raw) => {
        const d = section(r, 'distances');
        d['berlin-amsterdam'] = d['amsterdam-berlin'];
        delete d['amsterdam-berlin'];
      },
      'distances.berlin-amsterdam',
    ],
    ['tick length not dividing the day', (r: Raw) => (section(r, 'meta').tick_minutes = 7n), 'meta'],
    [
      'unknown clan rank',
      (r: Raw) => (section(r, 'clans').election_voter_min_rank = 'BOSS'),
      'clans.election_voter_min_rank',
    ],
    [
      'unknown profession in unlock',
      (r: Raw) => (section(r, 'unlocks', 'lkw').field = 'zauberei'),
      'unlocks.lkw.field',
    ],
    ['k_start outside [k_min, k_max]', (r: Raw) => (section(r, 'npc').k_max = 0.5), 'npc.k_start'],
    [
      'image with ".."',
      (r: Raw) => (section(r, 'goods', 'gras').image = 'goods/../../etc/x.webp'),
      'goods.gras.image',
    ],
    [
      'absolute image path',
      (r: Raw) => (section(r, 'goods', 'gras').image = '/goods/gras.webp'),
      'goods.gras.image',
    ],
    [
      'image with wrong extension',
      (r: Raw) => (section(r, 'goods', 'gras').image = 'goods/gras.gif'),
      'goods.gras.image',
    ],
    [
      'image in a foreign category',
      (r: Raw) => (section(r, 'goods', 'gras').image = 'vehicles/gras.webp'),
      'goods.gras.image',
    ],
    [
      'image on a weapon outside weapons/',
      (r: Raw) => (section(r, 'weapons', 'messer').image = 'armor/messer.png'),
      'weapons.messer.image',
    ],
    [
      'unknown fallback category',
      (r: Raw) => (r.images = { fallback: { food: 'goods/_fallback.svg' } }),
      'images.fallback',
    ],
    [
      'fallback in a foreign category',
      (r: Raw) => (r.images = { fallback: { goods: 'armor/_fallback.svg' } }),
      'images.fallback.goods',
    ],
    [
      'duplicate rank after mapping legacy names',
      (r: Raw) => (section(r, 'clans').ranks = ['PATE', 'GODFATHER', 'CAPO', 'SOLDAT', 'MITLAEUFER']),
      'clans.ranks',
    ],
  ])('%s', (_name, mutate, path) => {
    const issues = issuesFor(mutate);
    expect(issues.map((i) => i.path)).toContain(path);
  });

  it('rejects ranks that are neither technical nor legacy values', () => {
    const issues = issuesFor((r) => (section(r, 'clans').ranks = ['GODFATHER', 'BOSS']));
    expect(issues.map((i) => i.path)).toContain('clans.ranks.1');
  });

  it('reports all problems at once', () => {
    const issues = issuesFor((r) => {
      section(r, 'goods', 'gras').base_price = 1.5;
      section(r, 'meta').currency = 'USD';
    });
    expect(issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(['goods.gras.base_price', 'meta.currency']),
    );
  });

  it('fails fast on TOML syntax errors and missing files', () => {
    expect(() => parseGameParameters('[meta\nversion = 1')).toThrow(/toml syntax/);
    expect(() => loadGameParameters('/does/not/exist.toml')).toThrow(/\(file\)/);
    expect(() =>
      parseGameParameters(PARAMETERS_TOML.replace('base_price = 1_000', 'base_price = 10.5')),
    ).toThrow(/goods\.gras\.base_price/);
  });
});

describe('images (ADR-020, T-114a)', () => {
  it('accepts image fields on every category and the [images] fallbacks', () => {
    const r = raw();
    section(r, 'goods', 'gras').image = 'goods/gras.webp';
    section(r, 'vehicles', 'kleinwagen').image = 'vehicles/kleinwagen.png';
    section(r, 'weapons', 'messer').image = 'weapons/messer.svg';
    section(r, 'armor', 'weste').image = 'armor/weste.webp';
    section(r, 'crew', 'profi').image = 'crew/profi.webp';
    section(r, 'ships', 'shuttle').image = 'ships/shuttle.webp';
    r.images = { fallback: Object.fromEntries(IMAGE_CATEGORIES.map((c) => [c, `${c}/_fallback.svg`])) };
    const result = validateGameParameters(r);
    if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
    expect(result.params.goods.gras?.image).toBe('goods/gras.webp');
    expect(result.params.images?.fallback.ships).toBe('ships/_fallback.svg');
  });

  it('keeps images optional (current parameters.toml has none)', () => {
    const result = validateGameParameters(raw());
    expect(result.ok && result.params.images).toBeUndefined();
    expect(result.ok && result.params.goods.gras?.image).toBeUndefined();
  });
});

describe('clan ranks (ADR-021)', () => {
  it('uses exactly the values of the database enum ClanRole', () => {
    expect([...CLAN_RANKS].sort()).toEqual(Object.values($Enums.ClanRole).sort());
  });

  it('maps the legacy German values and reports them as warnings (until T-117)', () => {
    const result = validateGameParameters(raw());
    if (!result.ok) throw new Error('unexpected');
    expect(result.params.clans.ranks).toEqual(['GODFATHER', 'CONSIGLIERE', 'CAPO', 'SOLDIER', 'ASSOCIATE']);
    expect(result.params.clans.election_voter_min_rank).toBe('SOLDIER');
    expect(result.warnings.map((w) => w.path)).toEqual([
      'clans.ranks.0',
      'clans.ranks.3',
      'clans.ranks.4',
      'clans.election_voter_min_rank',
    ]);
  });

  it('accepts the technical values without warnings (state after T-117)', () => {
    const r = raw();
    const clans = section(r, 'clans');
    clans.ranks = [...CLAN_RANKS];
    clans.election_voter_min_rank = 'SOLDIER';
    const result = validateGameParameters(r);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.warnings).toEqual([]);
  });
});
