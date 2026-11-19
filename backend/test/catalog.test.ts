import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { catalogKeys, syncCatalog } from '../src/modules/catalog/catalog.js';
import { createTestApp, truncateAll } from './helpers.js';

/** Data model v2: catalog tables hold only keys from parameters.toml and are synced at startup. */
let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await truncateAll(app);
});

describe('catalog sync', () => {
  it('creates every key from parameters.toml and is idempotent', async () => {
    await syncCatalog(app.prisma, app.gameParams);
    await syncCatalog(app.prisma, app.gameParams);
    const keys = catalogKeys(app.gameParams);
    expect((await app.prisma.city.findMany()).map((c) => c.slug).sort()).toEqual([...keys.cities].sort());
    expect(await app.prisma.commodity.count()).toBe(keys.commodities.length);
    expect(await app.prisma.vehicleType.count()).toBe(keys.vehicleTypes.length);
    const equipment = await app.prisma.equipmentType.findMany();
    expect(equipment.find((e) => e.slug === 'messer')?.slot).toBe('WEAPON');
    expect(equipment.find((e) => e.slug === 'weste')?.slot).toBe('ARMOR');
  });

  it('refuses to start when the database holds keys the parameters do not define', async () => {
    await app.prisma.commodity.create({ data: { slug: 'atlantis_dust' } });
    await app.prisma.equipmentType.create({ data: { slug: 'messer', slot: 'ARMOR' } });
    await expect(createTestApp()).rejects.toThrow(
      /commodity "atlantis_dust" is not defined[\s\S]*"messer" has slot ARMOR/,
    );
    await truncateAll(app); // leave a clean catalog for the following test files
  });
});
