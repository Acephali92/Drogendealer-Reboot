import { describe, expect, it } from 'vitest';
import { imageFallbacks, imageFor, withImage, IMAGE_CATEGORIES } from '../../src/domain/index.js';
import { parseGameParameters } from '../../src/config/parameters.js';
import { PARAMETERS_TOML } from './golden.js';

const params = parseGameParameters(PARAMETERS_TOML);

describe('imageFor (ADR-020)', () => {
  it('returns the path from parameters.toml by technical key', () => {
    expect(imageFor(params, 'goods', 'gras')).toBe('goods/gras.webp');
    expect(imageFor(params, 'ships', 'kreuzer')).toBe('ships/kreuzer.webp');
  });

  it('returns null for unknown keys, keys of another category and prototype keys', () => {
    expect(imageFor(params, 'goods', 'unbekannt')).toBeNull();
    expect(imageFor(params, 'goods', 'kleinwagen')).toBeNull();
    expect(imageFor(params, 'goods', '__proto__')).toBeNull();
    expect(imageFor(params, 'goods', 'constructor')).toBeNull();
    expect(imageFor(params, 'goods', 'toString')).toBeNull();
  });

  it('withImage keeps the entry and adds image', () => {
    expect(withImage(params, 'vehicles', { slug: 'lkw', id: 'x' })).toEqual({
      slug: 'lkw',
      id: 'x',
      image: 'vehicles/lkw.webp',
    });
  });

  it('lists one fallback per category', () => {
    const fallbacks = imageFallbacks(params);
    expect(Object.keys(fallbacks).sort()).toEqual([...IMAGE_CATEGORIES].sort());
    expect(fallbacks.goods).toBe('goods/_fallback.svg');
  });
});
