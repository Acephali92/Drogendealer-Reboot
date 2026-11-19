/**
 * Test-only data factories. Catalog rows use real technical keys from parameters.toml
 * (e.g. "berlin", "gras"); their values and fictional display names come from the parameters
 * (data model v2). Catalog rows are upserted because syncCatalog creates them at startup and
 * truncateAll removes them between tests.
 */
import type { FastifyInstance } from 'fastify';
import type { ClanRole, EquipmentSlot } from '@prisma/client';
import { register } from './helpers.js';

let seq = 0;
const next = () => ++seq;

export const TEST_PASSWORD = 'password-123';

export async function createUser(app: FastifyInstance, name = `player_${next()}`) {
  const res = await register(app, {
    email: `${name}@example.com`,
    username: name,
    password: TEST_PASSWORD,
    ageConfirmed: true,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  const body = res.json<{ accessToken: string; user: { id: string; playerId: string } }>();
  return { token: body.accessToken, userId: body.user.id, playerId: body.user.playerId, name };
}

const upsertSlug = <T>(find: () => Promise<T | null>, create: () => Promise<T>) =>
  find().then((row) => row ?? create());

/** Location by key from [city.*] or [space_location.*]. */
export function createCity(app: FastifyInstance, slug: string) {
  return upsertSlug(
    () => app.prisma.city.findUnique({ where: { slug } }),
    () => app.prisma.city.create({ data: { slug } }),
  );
}

/** Good by key from [goods.*]. */
export function createCommodity(app: FastifyInstance, slug: string) {
  return upsertSlug(
    () => app.prisma.commodity.findUnique({ where: { slug } }),
    () => app.prisma.commodity.create({ data: { slug } }),
  );
}

/** Vehicle type by key from [vehicles.*]. */
export function createVehicleType(app: FastifyInstance, slug: string) {
  return upsertSlug(
    () => app.prisma.vehicleType.findUnique({ where: { slug } }),
    () => app.prisma.vehicleType.create({ data: { slug } }),
  );
}

/** Equipment type by key from [weapons.*] (WEAPON) or [armor.*] (ARMOR). */
export function createEquipmentType(app: FastifyInstance, slug: string, slot: EquipmentSlot) {
  return upsertSlug(
    () => app.prisma.equipmentType.findUnique({ where: { slug } }),
    () => app.prisma.equipmentType.create({ data: { slug, slot } }),
  );
}

/** Market state of a good in a city. */
export function setMarket(app: FastifyInstance, cityId: string, commodityId: string, stock = 500) {
  return app.prisma.marketState.create({ data: { cityId, commodityId, stock } });
}

/** Adds a lot to a player's inventory together with its movement journal entry. */
export async function addLot(
  app: FastifyInstance,
  playerId: string,
  commodityId: string,
  quantity: number,
  costBasis = 0n,
) {
  const before = await app.prisma.inventoryLot.aggregate({
    where: { playerId, commodityId },
    _sum: { quantity: true },
  });
  await app.prisma.inventoryLot.create({ data: { playerId, commodityId, quantity, costBasis } });
  await app.prisma.inventoryMovement.create({
    data: {
      playerId,
      commodityId,
      delta: quantity,
      quantityAfter: (before._sum.quantity ?? 0) + quantity,
      reason: 'ADMIN',
    },
  });
}

export async function createClan(
  app: FastifyInstance,
  tag: string,
  members: { playerId: string; role: ClanRole }[],
  treasuryCash = 0n,
) {
  return app.prisma.clan.create({
    data: { name: `Clan ${tag}`, tag, treasuryCash, members: { create: members } },
  });
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });
