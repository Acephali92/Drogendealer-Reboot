import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, truncateAll } from './helpers.js';
import { auth, createCity, createCommodity, createUser, createVehicleType, setPrice } from './fixtures.js';

/**
 * T-114 (ADR-020): catalog entries carry `image` from parameters.toml, matched by DB slug =
 * parameter key. Fixture slugs below are real keys from parameters.toml so they have images.
 */
let app: FastifyInstance;
let token: string;
let playerId: string;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await truncateAll(app);
  ({ token, playerId } = await createUser(app));
});

const get = (url: string, withToken = true) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: withToken ? auth(token) : {} });

const expectedImage = (category: 'goods' | 'vehicles' | 'weapons' | 'armor', key: string) => {
  const section = app.gameParams[category] as Record<string, { image?: string }>;
  return section[key]?.image ?? null;
};

describe('image paths in API responses', () => {
  it('adds image to commodities in market, overview and inventory', async () => {
    const city = await createCity(app, { slug: 'nebelstadt', name: 'Nebelstadt' });
    const gras = await createCommodity(app, 'gras');
    const unknown = await createCommodity(app, 'unbekannt');
    await setPrice(app, city.id, gras.id, 100n, 90n);
    await setPrice(app, city.id, unknown.id, 100n, 90n);
    await app.prisma.inventoryItem.create({ data: { playerId, commodityId: gras.id, quantity: 1 } });

    expect(expectedImage('goods', 'gras')).toBe('goods/gras.webp');

    const market = (await get('/cities/nebelstadt/market')).json();
    const bySlug = Object.fromEntries(
      market.prices.map((p: { commodity: { slug: string; image: string | null } }) => [
        p.commodity.slug,
        p.commodity.image,
      ]),
    );
    expect(bySlug).toEqual({ gras: 'goods/gras.webp', unbekannt: null });

    const overview = (await get('/market/overview')).json();
    expect(
      overview.commodities.find((c: { commodity: { slug: string } }) => c.commodity.slug === 'gras').commodity
        .image,
    ).toBe('goods/gras.webp');

    const inventory = (await get('/inventory')).json();
    expect(inventory.items[0].commodity.image).toBe('goods/gras.webp');
  });

  it('adds image to vehicle types, own vehicles and the current travel', async () => {
    const kleinwagen = await createVehicleType(app, 'kleinwagen', 300_000);
    await createVehicleType(app, 'raumgleiter', 1_000);
    const vehicle = await app.prisma.vehicle.create({
      data: { playerId, vehicleTypeId: kleinwagen.id, isActive: true },
    });
    const a = await createCity(app, { slug: 'a-stadt', name: 'A' });
    const b = await createCity(app, { slug: 'b-stadt', name: 'B' });
    await app.prisma.travel.create({
      data: {
        playerId,
        vehicleId: vehicle.id,
        fromCityId: a.id,
        toCityId: b.id,
        arrivesAt: new Date(Date.now() + 60_000),
      },
    });

    const types = (await get('/vehicle-types')).json().vehicleTypes;
    expect(
      Object.fromEntries(types.map((t: { slug: string; image: string | null }) => [t.slug, t.image])),
    ).toEqual({
      kleinwagen: 'vehicles/kleinwagen.webp',
      raumgleiter: null,
    });
    expect((await get('/vehicles')).json().vehicles[0].vehicleType.image).toBe('vehicles/kleinwagen.webp');
    expect((await get('/travel/current')).json().travel.vehicle.vehicleType.image).toBe(
      'vehicles/kleinwagen.webp',
    );
  });

  it('looks up equipment images by slot (weapons vs. armor)', async () => {
    const make = (slug: string, slot: 'WEAPON' | 'ARMOR') =>
      app.prisma.equipmentType.create({ data: { slug, name: slug, slot, price: 100n } });
    const messer = await make('messer', 'WEAPON');
    await make('weste', 'ARMOR');
    await make('lederjacke', 'WEAPON'); // armor key with weapon slot → no match
    await app.prisma.playerEquipment.create({
      data: { playerId, equipmentTypeId: messer.id, equipped: true },
    });

    const types = (await get('/equipment-types')).json().equipmentTypes;
    expect(
      Object.fromEntries(types.map((t: { slug: string; image: string | null }) => [t.slug, t.image])),
    ).toEqual({
      messer: expectedImage('weapons', 'messer'),
      weste: expectedImage('armor', 'weste'),
      lederjacke: null,
    });
    expect(expectedImage('weapons', 'messer')).toBe('weapons/messer.webp');
    expect((await get('/equipment')).json().equipment[0].equipmentType.image).toBe('weapons/messer.webp');
  });
});

describe('GET /api/v1/images', () => {
  it('returns fallbacks and allowed extensions without authentication', async () => {
    const res = await get('/images', false);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      fallback: {
        goods: 'goods/_fallback.svg',
        vehicles: 'vehicles/_fallback.svg',
        weapons: 'weapons/_fallback.svg',
        armor: 'armor/_fallback.svg',
        crew: 'crew/_fallback.svg',
        ships: 'ships/_fallback.svg',
      },
      allowedExtensions: ['.webp', '.png', '.svg'],
    });
  });
});
