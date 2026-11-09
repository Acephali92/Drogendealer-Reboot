/**
 * Test-only data factories. These are NOT game content – real cities, commodities and
 * balancing values come from the game designer.
 */
import type { FastifyInstance } from 'fastify';
import type { ClanRole } from '@prisma/client';
import { register } from './helpers.js';

let seq = 0;
const next = () => ++seq;

export async function createUser(app: FastifyInstance, name = `player_${next()}`) {
  const res = await register(app, { email: `${name}@example.com`, username: name, password: 'password-123', ageConfirmed: true });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  const body = res.json<{ accessToken: string; user: { id: string; playerId: string } }>();
  return { token: body.accessToken, userId: body.user.id, playerId: body.user.playerId, name };
}

export function createCity(app: FastifyInstance, data: { slug: string; name: string; policeStrength?: number }) {
  return app.prisma.city.create({ data: { country: 'Testland', techLevel: 2, population: 1000, ...data } });
}

export function connectCities(app: FastifyInstance, fromCityId: string, toCityId: string, distanceKm: number) {
  return app.prisma.cityConnection.create({ data: { fromCityId, toCityId, distanceKm } });
}

export function createCommodity(app: FastifyInstance, slug: string, unitWeightG = 1) {
  return app.prisma.commodity.create({
    data: { slug, name: slug.toUpperCase(), unitWeightG, basePrice: 100n, minPrice: 10n, maxPrice: 1000n },
  });
}

export function setPrice(
  app: FastifyInstance,
  cityId: string,
  commodityId: string,
  buyPrice: bigint,
  sellPrice: bigint,
) {
  return app.prisma.marketPrice.create({ data: { cityId, commodityId, buyPrice, sellPrice, supply: 50 } });
}

export function createVehicleType(app: FastifyInstance, slug: string, capacityG: number, price = 1000n) {
  return app.prisma.vehicleType.create({ data: { slug, name: slug, price, capacityG, speedKmh: 80 } });
}

export async function createClan(
  app: FastifyInstance,
  tag: string,
  members: { playerId: string; role: ClanRole }[],
  bank = 0n,
) {
  return app.prisma.clan.create({
    data: { name: `Clan ${tag}`, tag, bank, members: { create: members } },
  });
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
