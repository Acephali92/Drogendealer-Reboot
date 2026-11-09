// @vitest-environment node
import { imageFallbacks, readParams } from '../../vite/gameParams';
import { CITIES, COMMODITIES, DISTANCES, EQUIPMENT, START, VEHICLES } from './data';

/** Mock und Backend schöpfen aus derselben parameters.toml (ADR-020, T-115). */
describe('Mock-Daten aus parameters.toml', () => {
  const params = readParams() as Record<string, Record<string, Record<string, unknown>>>;

  it('übernimmt Städte, Anzeigenamen und Distanzen', () => {
    expect(CITIES.map((c) => c.slug).sort()).toEqual(Object.keys(params.city!).sort());
    for (const c of CITIES) expect(c.name).toBe(params.city![c.slug]!.name);
    expect(DISTANCES['berlin-hamburg']).toBe(params.distances!['berlin-hamburg']);
  });

  it('übernimmt Waren mit Namen, Preis und Bildpfad', () => {
    for (const g of COMMODITIES) {
      const src = params.goods![g.slug]!;
      expect(g.name).toBe(src.name);
      expect(g.basePrice).toBe(src.base_price);
      expect(g.image).toBe((src.image as string | undefined) ?? null);
    }
  });

  it('übernimmt Fahrzeuge, Ausrüstung und Startwerte', () => {
    expect(VEHICLES.map((v) => v.name)).toEqual(Object.values(params.vehicles!).map((v) => v.name));
    expect(EQUIPMENT.length).toBe(Object.keys(params.weapons!).length + Object.keys(params.armor!).length);
    for (const e of EQUIPMENT) expect(e.name).not.toBe(e.slug); // nie den Schlüssel anzeigen (T-112)
    expect(START.cash).toBe((params.player as unknown as Record<string, number>).start_cash_black);
  });

  it('liest Kategorie-Platzhalter nur als sichere Pfade', () => {
    expect(
      imageFallbacks({ images: { fallback: { goods: 'goods/_fallback.svg', vehicles: '../x.svg' } } }),
    ).toMatchObject({
      goods: 'goods/_fallback.svg',
      vehicles: null,
      ships: null,
    });
  });
});
