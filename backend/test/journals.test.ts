import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setMarketChangeContext } from '../src/modules/world/market-journal.js';
import { bookMoney } from '../src/modules/money/ledger.js';
import { createTestApp, truncateAll } from './helpers.js';
import { addLot, createCity, createClan, createCommodity, createUser, setMarket } from './fixtures.js';

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

async function seedMarket() {
  const city = await createCity(app, 'berlin');
  const commodity = await createCommodity(app, 'gras');
  const state = await setMarket(app, city.id, commodity.id, 500);
  return { city, commodity, state };
}

const marketJournal = () => app.prisma.marketStateChange.findMany({ orderBy: { createdAt: 'asc' } });

describe('market state journal (T-105, GAME_ECONOMY.md §7 T-2/T-6)', () => {
  it('logs the initial state on insert', async () => {
    const { city, commodity } = await seedMarket();
    const rows = await marketJournal();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cityId: city.id,
      commodityId: commodity.id,
      oldStock: null,
      newStock: 500,
      oldNoise: null,
      newNoise: 0,
      cause: 'INITIAL',
      refId: null,
      tick: null,
    });
  });

  it('records old/new stock, noise and event with cause, reference and tick', async () => {
    const { state } = await seedMarket();
    await app.prisma.$transaction(async (tx) => {
      await setMarketChangeContext(tx, 'NPC', 'npc-flow-7', 4321);
      await tx.marketState.update({
        where: { id: state.id },
        data: { stock: 480.25, noise: -0.012, activeEvent: 'razzia', eventTicksLeft: 36 },
      });
    });
    expect((await marketJournal()).at(-1)).toMatchObject({
      oldStock: 500,
      newStock: 480.25,
      oldNoise: 0,
      newNoise: -0.012,
      oldEvent: null,
      newEvent: 'razzia',
      cause: 'NPC',
      refId: 'npc-flow-7',
      tick: 4321,
    });
  });

  it('does not leak the context into later transactions and skips pure countdowns', async () => {
    const { state } = await seedMarket();
    await app.prisma.$transaction(async (tx) => {
      await setMarketChangeContext(tx, 'TICK', undefined, 1);
      await tx.marketState.update({ where: { id: state.id }, data: { stock: 490 } });
    });
    await app.prisma.marketState.update({ where: { id: state.id }, data: { stock: 491 } });
    await app.prisma.marketState.update({ where: { id: state.id }, data: { eventTicksLeft: 5 } });
    expect((await marketJournal()).map((r) => [r.cause, r.tick])).toEqual([
      ['INITIAL', null],
      ['TICK', 1],
      ['UNSPECIFIED', null],
    ]);
  });

  it('rejects an invalid tick before writing', async () => {
    await expect(
      app.prisma.$transaction((tx) => setMarketChangeContext(tx, 'TICK', undefined, -1)),
    ).rejects.toThrow(RangeError);
  });
});

describe('all journals are append-only (ADR-010)', () => {
  it('rejects UPDATE and DELETE on every journal table', async () => {
    const { commodity } = await seedMarket();
    const user = await createUser(app);
    await addLot(app, user.playerId, commodity.id, 2);
    const clan = await createClan(app, 'JRN', [{ playerId: user.playerId, role: 'GODFATHER' }]);
    await app.prisma.clanTreasuryTransaction.create({
      data: { clanId: clan.id, account: 'CASH', amount: 1n, balanceAfter: 1n, reason: 'ADMIN' },
    });

    const tables = [
      app.prisma.marketStateChange,
      app.prisma.moneyTransaction, // START_CAPITAL from registration
      app.prisma.inventoryMovement,
      app.prisma.clanTreasuryTransaction,
    ] as unknown as {
      findFirstOrThrow(): Promise<{ id: string }>;
      update(a: object): Promise<unknown>;
      delete(a: object): Promise<unknown>;
    }[];

    for (const table of tables) {
      const row = await table.findFirstOrThrow();
      await expect(table.update({ where: { id: row.id }, data: { refId: 'x' } })).rejects.toThrow(
        /append-only/,
      );
      await expect(table.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    }
  });

  it('keeps history: catalog rows and players with journal entries cannot be deleted', async () => {
    const { city } = await seedMarket();
    await expect(app.prisma.city.delete({ where: { id: city.id } })).rejects.toThrow();
    const user = await createUser(app);
    await expect(app.prisma.player.delete({ where: { id: user.playerId } })).rejects.toThrow();
  });
});

describe('money ledger (invariant M-1)', () => {
  it('books into the projection and the journal together and refuses overdrafts', async () => {
    const user = await createUser(app);
    const start = (await app.prisma.player.findUniqueOrThrow({ where: { id: user.playerId } })).cash;

    await app.prisma.$transaction((tx) =>
      bookMoney(tx, {
        playerId: user.playerId,
        account: 'CASH',
        amount: -1n,
        reason: 'TRADE_BUY',
        refId: 't1',
      }),
    );
    await expect(
      app.prisma.$transaction((tx) =>
        bookMoney(tx, { playerId: user.playerId, account: 'BANK', amount: -1n, reason: 'TRADE_BUY' }),
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });

    const player = await app.prisma.player.findUniqueOrThrow({ where: { id: user.playerId } });
    expect(player.cash).toBe(start - 1n);
    expect(player.bank).toBe(0n);
    const sums = await app.prisma.moneyTransaction.groupBy({
      by: ['account'],
      where: { playerId: user.playerId },
      _sum: { amount: true },
    });
    expect(Object.fromEntries(sums.map((s) => [s.account, s._sum.amount]))).toEqual({ CASH: player.cash });
  });
});
