import { imageCandidates, safeImagePath } from './imagePath';

describe('safeImagePath', () => {
  it('akzeptiert relative Bildpfade', () => {
    expect(safeImagePath('goods/gras.webp')).toBe('goods/gras.webp');
    expect(safeImagePath('goods/_fallback.svg')).toBe('goods/_fallback.svg');
  });
  it('lehnt unsichere oder falsche Pfade ab', () => {
    for (const p of [
      '../secret.png',
      '/abs.png',
      'https://x.de/a.png',
      'a\\b.png',
      'goods/gras.jpg',
      '',
      null,
      42,
    ])
      expect(safeImagePath(p)).toBeNull();
  });
});

describe('imageCandidates', () => {
  it('liefert Bild, dann Platzhalter, ohne Duplikate', () => {
    expect(imageCandidates('/', 'goods/gras.webp', 'goods/_fallback.svg')).toEqual([
      '/images/goods/gras.webp',
      '/images/goods/_fallback.svg',
    ]);
    expect(imageCandidates('/app', 'goods/_fallback.svg', 'goods/_fallback.svg')).toEqual([
      '/app/images/goods/_fallback.svg',
    ]);
    expect(imageCandidates('/', null, null)).toEqual([]);
  });
});
