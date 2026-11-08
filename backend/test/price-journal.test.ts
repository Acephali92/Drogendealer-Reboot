import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setPriceChangeContext } from '../src/modules/world/price-journal.js';
import { createTestApp, truncateAll } from './helpers.js';
import { createCity, createCommodity, setPrice } from './fixtures.js';

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

async function seed() {
  const city = await createCity(app, { slug: 'berlin', name: 'Berlin' });
  const commodity = await createCommodity(app, 'weed');
  const price = await setPrice(app, city.id, commodity.id, 100n, 90n);
  return { city, commodity, price };
}

const journal = () => app.prisma.marketPriceChange.findMany({ orderBy: { createdAt: 'asc' } });

describe('market price journal (T-105)', () => {
  it('logs the initial price on insert', async () => {
    const { city, commodity } = await seed();
    const rows = await journal();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cityId: city.id,
      commodityId: commodity.id,
      oldBuyPrice: null,
      newBuyPrice: 100n,
      oldSellPrice: null,
      newSellPrice: 90n,
      oldSupply: null,
      newSupply: 50,
      cause: 'INITIAL',
      refId: null,
    });
  });

  it('records old/new values with cause and reference set in the transaction', async () => {
    const { price } = await seed();
    await app.prisma.$transaction(async (tx) => {
      await setPriceChangeContext(tx, 'TRADE', 'trade-123');
      await tx.marketPrice.update({ where: { id: price.id }, data: { buyPrice: 120n, supply: 40 } });
    });
    const last = (await journal()).at(-1);
    expect(last).toMatchObject({
      oldBuyPrice: 100n,
      newBuyPrice: 120n,
      oldSellPrice: 90n,
      newSellPrice: 90n,
      oldSupply: 50,
      newSupply: 40,
      cause: 'TRADE',
      refId: 'trade-123',
    });
  });

  it('does not leak the context into later transactions', async () => {
    const { price } = await seed();
    await app.prisma.$transaction(async (tx) => {
      await setPriceChangeContext(tx, 'TICK', '42');
      await tx.marketPrice.update({ where: { id: price.id }, data: { sellPrice: 95n } });
    });
    await app.prisma.marketPrice.update({ where: { id: price.id }, data: { sellPrice: 96n } });
    const rows = await journal();
    expect(rows.map((r) => [r.cause, r.refId])).toEqual([
      ['INITIAL', null],
      ['TICK', '42'],
      ['UNSPECIFIED', null],
    ]);
  });

  it('ignores updates that do not change price or supply', async () => {
    const { price } = await seed();
    await app.prisma.marketPrice.update({ where: { id: price.id }, data: { buyPrice: 100n } });
    expect(await journal()).toHaveLength(1);
  });

  it('is append-only', async () => {
    await seed();
    const [row] = await journal();
    await expect(
      app.prisma.marketPriceChange.update({ where: { id: row!.id }, data: { newBuyPrice: 1n } }),
    ).rejects.toThrow(/append-only/);
    await expect(app.prisma.marketPriceChange.delete({ where: { id: row!.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('keeps history by preventing deletion of cities with journal entries', async () => {
    const { city } = await seed();
    await expect(app.prisma.city.delete({ where: { id: city.id } })).rejects.toThrow();
  });
});
