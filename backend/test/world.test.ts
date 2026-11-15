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
import { golden } from './domain/golden.js';

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

const get = (url: string) => app.inject({ method: 'GET', url: `/api/v1${url}`, headers: auth(token) });

async function seedWorld() {
  const berlin = await createCity(app, 'berlin');
  const hamburg = await createCity(app, 'hamburg');
  const muenchen = await createCity(app, 'muenchen');
  const amsterdam = await createCity(app, 'amsterdam');
  const gras = await createCommodity(app, 'gras');
  const kokain = await createCommodity(app, 'kokain');
  await setMarket(app, amsterdam.id, gras.id);
  await setMarket(app, muenchen.id, gras.id);
  await setMarket(app, berlin.id, gras.id);
  await setMarket(app, berlin.id, kokain.id, 123.5);
  return { berlin, hamburg, muenchen, amsterdam, gras, kokain };
}

describe('cities (values from parameters.toml)', () => {
  it('lists locations with name, population, wealth, police and fuel price', async () => {
    await seedWorld();
    const res = await get('/cities');
    expect(res.statusCode).toBe(200);
    const berlin = res.json().cities.find((c: { slug: string }) => c.slug === 'berlin');
    const p = app.gameParams.city.berlin!;
    expect(berlin).toMatchObject({
      name: p.name,
      realm: 'earth',
      pop: p.pop,
      wealth: p.wealth,
      police: p.police,
      fuelPrice: p.fuel_price.toString(),
      spaceport: p.spaceport,
    });
    expect(berlin).not.toHaveProperty('country');
  });

  it('returns road connections from [distances], sorted by distance', async () => {
    const { hamburg } = await seedWorld();
    const { city } = (await get('/cities/berlin')).json();
    expect(city.connections[0]).toEqual({
      toCityId: hamburg.id,
      toCity: { id: hamburg.id, slug: 'hamburg', name: app.gameParams.city.hamburg!.name },
      distanceKm: app.gameParams.distances['berlin-hamburg'],
    });
    const distances = city.connections.map((c: { distanceKm: number }) => c.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('returns 404 for unknown cities', async () => {
    for (const url of ['/cities/atlantis', '/cities/atlantis/market']) {
      const res = await get(url);
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('CITY_NOT_FOUND');
    }
  });
});

describe('market', () => {
  it('returns market state and the equilibrium price F-ECO-07 (EX-ECO-01)', async () => {
    await seedWorld();
    const ex = golden.examples['EX-ECO-01'] as { P_amsterdam: number; P_muenchen: number };
    const ams = (await get('/cities/amsterdam/market')).json();
    expect(ams.city).toMatchObject({ slug: 'amsterdam', name: app.gameParams.city.amsterdam!.name });
    expect(ams.markets[0]).toMatchObject({
      stock: 500,
      referencePrice: String(Math.round(ex.P_amsterdam)),
      activeEvent: null,
      commodity: {
        slug: 'gras',
        name: app.gameParams.goods.gras!.name,
        unitVolume: app.gameParams.goods.gras!.volume,
        basePrice: app.gameParams.goods.gras!.base_price.toString(),
        image: 'goods/gras.webp',
      },
    });
    const berlinKokain = (await get('/cities/berlin/market'))
      .json()
      .markets.find((m: { commodity: { slug: string } }) => m.commodity.slug === 'kokain');
    expect(berlinKokain.stock).toBe(123.5); // float stock (B-14)
  });

  it('finds the cheapest and the most expensive city per good', async () => {
    await seedWorld();
    const ex = golden.examples['EX-ECO-01'] as { P_amsterdam: number; P_muenchen: number };
    const gras = (await get('/market/overview'))
      .json()
      .commodities.find((c: { commodity: { slug: string } }) => c.commodity.slug === 'gras');
    expect(gras.lowestPrice).toMatchObject({
      city: { slug: 'amsterdam' },
      referencePrice: String(Math.round(ex.P_amsterdam)),
    });
    expect(gras.highestPrice).toMatchObject({
      city: { slug: 'muenchen' },
      referencePrice: String(Math.round(ex.P_muenchen)),
    });
  });
});

describe('inventory (volume units, T-119)', () => {
  it('has the backpack capacity without a vehicle', async () => {
    const res = await get('/inventory');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], capacity: app.gameParams.player.backpack_capacity, used: 0 });
  });

  it('adds the active vehicle capacity, sums volume and computes the average buy price', async () => {
    const { gras, kokain } = await seedWorld();
    await addLot(app, playerId, gras.id, 10, 9_000n);
    await addLot(app, playerId, gras.id, 5, 6_001n);
    await addLot(app, playerId, kokain.id, 3, 30_000n);
    const kleinwagen = await createVehicleType(app, 'kleinwagen');
    const lkw = await createVehicleType(app, 'lkw');
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: lkw.id, isActive: false } });
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: kleinwagen.id, isActive: true } });

    const body = (await get('/inventory')).json();
    const p = app.gameParams;
    expect(body.capacity).toBe(p.player.backpack_capacity + p.vehicles.kleinwagen!.capacity);
    expect(body.used).toBe(15 * p.goods.gras!.volume + 3 * p.goods.kokain!.volume);
    const grasItem = body.items.find((i: { commodity: { slug: string } }) => i.commodity.slug === 'gras');
    expect(grasItem).toMatchObject({ quantity: 15, avgBuyPrice: '1000' }); // 15001 / 15 rounded down
  });
});

describe('vehicles and equipment (catalog from parameters.toml)', () => {
  it('lists catalogs by price and own items', async () => {
    const kleinwagen = await createVehicleType(app, 'kleinwagen');
    await createVehicleType(app, 'lkw');
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: kleinwagen.id, isActive: true } });
    const messer = await createEquipmentType(app, 'messer', 'WEAPON');
    await createEquipmentType(app, 'weste', 'ARMOR');
    await app.prisma.playerEquipment.create({
      data: { playerId, equipmentTypeId: messer.id, equipped: true },
    });

    const types = (await get('/vehicle-types')).json().vehicleTypes;
    expect(types.map((t: { slug: string }) => t.slug)).toEqual(['kleinwagen', 'lkw']);
    const v = app.gameParams.vehicles.kleinwagen!;
    expect(types[0]).toEqual({
      id: kleinwagen.id,
      slug: 'kleinwagen',
      name: v.name,
      price: v.price.toString(),
      speedKmh: v.speed,
      consumptionPer100Km: v.consumption,
      capacity: v.capacity,
      hide: v.hide,
      image: 'vehicles/kleinwagen.webp',
    });
    expect((await get('/vehicles')).json().vehicles[0]).toMatchObject({
      isActive: true,
      vehicleType: { slug: 'kleinwagen', capacity: v.capacity },
    });

    const eq = (await get('/equipment-types')).json().equipmentTypes;
    expect(eq.map((e: { slot: string }) => e.slot)).toEqual(['WEAPON', 'ARMOR']);
    expect(eq[0]).toMatchObject({
      slug: 'messer',
      name: app.gameParams.weapons.messer!.name ?? null,
      strength: app.gameParams.weapons.messer!.strength,
      price: app.gameParams.weapons.messer!.price.toString(),
      image: 'weapons/messer.webp',
    });
    expect((await get('/equipment')).json().equipment[0]).toMatchObject({
      equipped: true,
      equipmentType: { slug: 'messer' },
    });
  });
});

describe('travel', () => {
  it('returns null without an active travel and the travel otherwise', async () => {
    expect((await get('/travel/current')).json()).toEqual({ travel: null });

    const { berlin, hamburg } = await seedWorld();
    const arrivesAt = new Date(Date.now() + 60_000);
    await app.prisma.travel.create({
      data: { playerId, fromCityId: berlin.id, toCityId: hamburg.id, arrivesAt },
    });
    const { travel } = (await get('/travel/current')).json();
    expect(travel).toMatchObject({
      status: 'IN_PROGRESS',
      arrivesAt: arrivesAt.toISOString(),
      fromCity: { slug: 'berlin', name: app.gameParams.city.berlin!.name },
      toCity: { slug: 'hamburg' },
      vehicle: null,
    });
  });
});
