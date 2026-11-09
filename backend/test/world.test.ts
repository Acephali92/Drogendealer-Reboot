import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, truncateAll } from './helpers.js';
import {
  auth,
  connectCities,
  createCity,
  createCommodity,
  createUser,
  createVehicleType,
  setPrice,
} from './fixtures.js';

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
  const berlin = await createCity(app, { slug: 'berlin', name: 'Berlin', policeStrength: 60 });
  const hamburg = await createCity(app, { slug: 'hamburg', name: 'Hamburg' });
  const munich = await createCity(app, { slug: 'muenchen', name: 'München' });
  await connectCities(app, berlin.id, hamburg.id, 290);
  await connectCities(app, berlin.id, munich.id, 585);
  const weed = await createCommodity(app, 'weed', 2);
  const coke = await createCommodity(app, 'coke', 5);
  await setPrice(app, berlin.id, weed.id, 100n, 90n);
  await setPrice(app, hamburg.id, weed.id, 80n, 70n);
  await setPrice(app, munich.id, weed.id, 150n, 140n);
  await setPrice(app, berlin.id, coke.id, 9_000_000_000n, 8_000_000_000n); // > 2^31 to check BigInt
  return { berlin, hamburg, munich, weed, coke };
}

describe('cities', () => {
  it('lists cities with frontend fields', async () => {
    await seedWorld();
    const res = await get('/cities');
    expect(res.statusCode).toBe(200);
    const { cities } = res.json();
    expect(cities.map((c: { slug: string }) => c.slug)).toEqual(['berlin', 'hamburg', 'muenchen']);
    expect(cities[0]).toMatchObject({
      name: 'Berlin',
      country: 'Testland',
      techLevel: 2,
      policeStrength: 60,
      population: 1000,
    });
  });

  it('returns city details with connections sorted by distance', async () => {
    const { hamburg } = await seedWorld();
    const res = await get('/cities/berlin');
    expect(res.statusCode).toBe(200);
    const { city } = res.json();
    expect(city.connections).toEqual([
      { toCityId: hamburg.id, distanceKm: 290, toCity: { id: hamburg.id, slug: 'hamburg', name: 'Hamburg' } },
      expect.objectContaining({ distanceKm: 585 }),
    ]);
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
  it('returns the market of a city with prices as strings', async () => {
    await seedWorld();
    const res = await get('/cities/berlin/market');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.city.slug).toBe('berlin');
    expect(body.prices).toHaveLength(2);
    const coke = body.prices.find((p: { commodity: { slug: string } }) => p.commodity.slug === 'coke');
    expect(coke).toMatchObject({ buyPrice: '9000000000', sellPrice: '8000000000', supply: 50 });
    expect(coke.commodity).toMatchObject({ illegal: true, unitWeightG: 5, basePrice: '100' });
  });

  it('finds the cheapest buy and best sell city per commodity', async () => {
    await seedWorld();
    const res = await get('/market/overview');
    expect(res.statusCode).toBe(200);
    const weed = res.json().commodities.find((c: { commodity: { slug: string } }) => c.commodity.slug === 'weed');
    expect(weed.lowestBuy).toMatchObject({ price: '80', city: { slug: 'hamburg' } });
    expect(weed.highestSell).toMatchObject({ price: '140', city: { slug: 'muenchen' } });
  });
});

describe('inventory', () => {
  it('is empty with null capacity for a new player', async () => {
    const res = await get('/inventory');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], capacityG: null, usedG: 0 });
  });

  it('sums weight and uses the active vehicle capacity', async () => {
    const { weed, coke } = await seedWorld();
    await app.prisma.inventoryItem.createMany({
      data: [
        { playerId, commodityId: weed.id, quantity: 10, avgBuyPrice: 95n },
        { playerId, commodityId: coke.id, quantity: 3, avgBuyPrice: 1000n },
      ],
    });
    const van = await createVehicleType(app, 'van', 50_000);
    const bike = await createVehicleType(app, 'bike', 2_000);
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: bike.id, isActive: false } });
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: van.id, isActive: true } });

    const body = (await get('/inventory')).json();
    expect(body.capacityG).toBe(50_000);
    expect(body.usedG).toBe(10 * 2 + 3 * 5);
    expect(body.items[1]).toMatchObject({ quantity: 10, avgBuyPrice: '95', commodity: { slug: 'weed' } });
  });
});

describe('vehicles and equipment', () => {
  it('lists catalogs and own items', async () => {
    const van = await createVehicleType(app, 'van', 50_000, 5000n);
    await createVehicleType(app, 'bike', 2_000, 300n);
    await app.prisma.vehicle.create({ data: { playerId, vehicleTypeId: van.id, isActive: true } });
    const pistol = await app.prisma.equipmentType.create({
      data: { slug: 'pistol', name: 'Pistole', slot: 'WEAPON', attack: 5, weightG: 900, price: 700n },
    });
    await app.prisma.playerEquipment.create({ data: { playerId, equipmentTypeId: pistol.id, equipped: true } });

    const types = (await get('/vehicle-types')).json().vehicleTypes;
    expect(types.map((t: { slug: string }) => t.slug)).toEqual(['bike', 'van']);
    expect(types[1]).toMatchObject({ capacityG: 50_000, speedKmh: 80, price: '5000', licenseClass: null });

    const vehicles = (await get('/vehicles')).json().vehicles;
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]).toMatchObject({ isActive: true, vehicleType: { slug: 'van' } });

    const eqTypes = (await get('/equipment-types')).json().equipmentTypes;
    expect(eqTypes[0]).toMatchObject({ slug: 'pistol', weightG: 900, price: '700' });
    const equipment = (await get('/equipment')).json().equipment;
    expect(equipment[0]).toMatchObject({ equipped: true, equipmentType: { slug: 'pistol' } });
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
      fromCity: { slug: 'berlin' },
      toCity: { slug: 'hamburg' },
      vehicle: null,
    });
  });
});
