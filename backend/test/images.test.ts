import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, truncateAll } from './helpers.js';
import {
  addLot,
  auth,
  createCity,
  createCommodity,
  createEquipmentType,
  createUser,
  createVehicleType,
  setMarket,
} from './fixtures.js';

/**
 * T-114 (ADR-020): catalog entries carry `image` from parameters.toml, matched by DB slug =
 * parameter key. Since data model v2 every catalog row is a key from parameters.toml.
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

describe('image paths in API responses', () => {
  it('adds image to commodities in market, overview and inventory', async () => {
    const city = await createCity(app, 'berlin');
    const gras = await createCommodity(app, 'gras');
    await setMarket(app, city.id, gras.id);
    await addLot(app, playerId, gras.id, 1);

    const market = (await get('/cities/berlin/market')).json();
    expect(market.markets[0].commodity.image).toBe('goods/gras.webp');
    const overview = (await get('/market/overview')).json();
    expect(overview.commodities[0].commodity.image).toBe('goods/gras.webp');
    expect((await get('/inventory')).json().items[0].commodity.image).toBe('goods/gras.webp');
  });

  it('adds image to vehicle types, own vehicles and the current travel', async () => {
    const kleinwagen = await createVehicleType(app, 'kleinwagen');
    const vehicle = await app.prisma.vehicle.create({
      data: { playerId, vehicleTypeId: kleinwagen.id, isActive: true },
    });
    const a = await createCity(app, 'berlin');
    const b = await createCity(app, 'hamburg');
    await app.prisma.travel.create({
      data: {
        playerId,
        vehicleId: vehicle.id,
        fromCityId: a.id,
        toCityId: b.id,
        arrivesAt: new Date(Date.now() + 60_000),
      },
    });

    expect((await get('/vehicle-types')).json().vehicleTypes[0].image).toBe('vehicles/kleinwagen.webp');
    expect((await get('/vehicles')).json().vehicles[0].vehicleType.image).toBe('vehicles/kleinwagen.webp');
    expect((await get('/travel/current')).json().travel.vehicle.vehicleType.image).toBe(
      'vehicles/kleinwagen.webp',
    );
  });

  it('looks up equipment images by slot (weapons vs. armor)', async () => {
    const messer = await createEquipmentType(app, 'messer', 'WEAPON');
    await createEquipmentType(app, 'weste', 'ARMOR');
    await app.prisma.playerEquipment.create({
      data: { playerId, equipmentTypeId: messer.id, equipped: true },
    });

    const types = (await get('/equipment-types')).json().equipmentTypes;
    expect(
      Object.fromEntries(types.map((t: { slug: string; image: string | null }) => [t.slug, t.image])),
    ).toEqual({
      messer: 'weapons/messer.webp',
      weste: 'armor/weste.webp',
    });
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
