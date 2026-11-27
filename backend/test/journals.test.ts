import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setMarketChangeContext } from '../src/modules/world/market-journal.js';
import { setJournalContext } from '../src/modules/journal/context.js';
import { bookMoney } from '../src/modules/money/ledger.js';
import { createTestApp, truncateAll } from './helpers.js';
import {
  addLot,
  createCity,
  createClan,
  createCommodity,
  createUser,
  inJournal,
  setMarket,
} from './fixtures.js';

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

const marketJournal = () => app.prisma.marketStateChange.findMany({ orderBy: { seq: 'asc' } });

const TICK_DETAIL = { S_before: 500, S_target: 520, x_before: 0, z: 0.3, x_after: 0.004 };

describe('market state journal (T-105, fail-closed per TD-022)', () => {
  it('logs the initial state on insert with tick, version and correlationId of the context', async () => {
    const corr = '11111111-1111-4111-8111-111111111111';
    const city = await createCity(app, 'berlin');
    const commodity = await createCommodity(app, 'gras');
    await inJournal(
      app,
      (tx) => tx.marketState.create({ data: { cityId: city.id, commodityId: commodity.id, stock: 500 } }),
      {
        tick: 12,
        correlationId: corr,
      },
    );
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
      tick: 12,
      version: 1,
      newEventTicksLeft: 0,
      correlationId: corr,
    });
  });

  it('records old/new state with cause, reference, detail and tick; versions are gapless', async () => {
    const { state } = await seedMarket();
    const detail = { from: 'berlin', to: 'hamburg', q: 12.5, margin: 0.3, theta: 0.45, f: 0.1, k: 1 };
    await inJournal(
      app,
      async (tx) => {
        await setMarketChangeContext(tx, { cause: 'NPC', refId: 'npc-flow-7', detail });
        await tx.marketState.update({
          where: { id: state.id },
          data: { stock: 480.25, noise: -0.012, activeEvent: 'razzia', eventTicksLeft: 36 },
        });
      },
      { tick: 4321, actor: { type: 'NPC' } },
    );
    expect((await marketJournal()).at(-1)).toMatchObject({
      oldStock: 500,
      newStock: 480.25,
      oldNoise: 0,
      newNoise: -0.012,
      oldEvent: null,
      newEvent: 'razzia',
      newEventTicksLeft: 36,
      cause: 'NPC',
      refId: 'npc-flow-7',
      tick: 4321,
      version: 2,
      detail,
    });
    expect((await app.prisma.marketState.findUniqueOrThrow({ where: { id: state.id } })).version).toBe(2);
  });

  it('rejects changes without cause or without journal context, and skips pure countdowns', async () => {
    const { state } = await seedMarket();
    await inJournal(app, async (tx) => {
      await setMarketChangeContext(tx, { cause: 'TICK', detail: TICK_DETAIL });
      await tx.marketState.update({ where: { id: state.id }, data: { stock: 490 } });
    });
    // The context does not leak into the next transaction: no cause → rejected.
    await expect(
      inJournal(app, (tx) => tx.marketState.update({ where: { id: state.id }, data: { stock: 491 } })),
    ).rejects.toThrow(/MARKET_CONTEXT_MISSING/);
    // A cause without journal context (tick, correlationId) is rejected as well.
    await expect(
      app.prisma.$transaction(async (tx) => {
        await setMarketChangeContext(tx, { cause: 'ADMIN' });
        await tx.marketState.update({ where: { id: state.id }, data: { stock: 492 } });
      }),
    ).rejects.toThrow(/JOURNAL_CONTEXT_MISSING/);
    // eventTicksLeft alone is a deterministic countdown, not a change: no row, no version.
    await app.prisma.marketState.update({ where: { id: state.id }, data: { eventTicksLeft: 5 } });
    expect((await marketJournal()).map((r) => [r.cause, r.version])).toEqual([
      ['INITIAL', 1],
      ['TICK', 2],
    ]);
  });

  it('requires refId for TRADE and the formula keys per cause in detail', async () => {
    const { state } = await seedMarket();
    const change = (ctx: Parameters<typeof setMarketChangeContext>[1], stock: number) =>
      inJournal(app, async (tx) => {
        await setMarketChangeContext(tx, ctx);
        await tx.marketState.update({ where: { id: state.id }, data: { stock } });
      });
    const trade = { q: 10, l_handel: 0, spread: 0.08 };
    await expect(change({ cause: 'TRADE', detail: trade }, 490)).rejects.toThrow(
      /MarketStateChange_trade_ref/,
    );
    await expect(change({ cause: 'TICK' }, 490)).rejects.toThrow(/MarketStateChange_detail_keys/);
    await expect(change({ cause: 'TICK', detail: { S_before: 1 } }, 490)).rejects.toThrow(
      /MarketStateChange_detail_keys/,
    );
    await expect(change({ cause: 'UNSPECIFIED' }, 490)).rejects.toThrow(/MarketStateChange_no_unspecified/);
    await change({ cause: 'TRADE', refId: 'trade-1', detail: trade }, 490);
    await change({ cause: 'ADMIN' }, 495);
    expect((await marketJournal()).map((r) => r.version)).toEqual([1, 2, 3]);
  });
});

describe('journal context (TD-022: tick, correlationId, actor, seq)', () => {
  it('rejects a booking without journal context (fail-closed)', async () => {
    const user = await createUser(app);
    await expect(
      app.prisma.$transaction((tx) =>
        bookMoney(tx, { playerId: user.playerId, account: 'CASH', amount: 1n, reason: 'ADMIN' }),
      ),
    ).rejects.toThrow(/JOURNAL_CONTEXT_MISSING/);
  });

  it('registration: the START_CAPITAL rows form one action of the system at tick 0', async () => {
    const user = await createUser(app);
    const rows = await app.prisma.moneyTransaction.findMany({
      where: { playerId: user.playerId },
      orderBy: { seq: 'asc' },
    });
    // One row per non-zero start amount (parameters.toml [player]; start_cash_white may be 0).
    const { start_cash_black, start_cash_white } = app.gameParams.player;
    const expected = (
      [
        ['CASH', start_cash_black],
        ['BANK', start_cash_white],
      ] as const
    ).filter(([, a]) => a > 0n);
    expect(rows.map((r) => [r.account, r.amount])).toEqual(expected);
    expect(new Set(rows.map((r) => r.correlationId)).size).toBe(1);
    for (const r of rows) expect(r).toMatchObject({ tick: 0, actorType: 'SYSTEM', actorPlayerId: null });
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.seq).toBeGreaterThan(rows[i - 1]!.seq);
  });

  it('stores the acting player and checks the actor shape', async () => {
    const user = await createUser(app);
    const corr = await app.prisma.$transaction(async (tx) => {
      const id = await setJournalContext(tx, { tick: 3, actor: { type: 'PLAYER', playerId: user.playerId } });
      await bookMoney(tx, { playerId: user.playerId, account: 'CASH', amount: -1n, reason: 'BRIBE' });
      return id;
    });
    expect(await app.prisma.moneyTransaction.findFirstOrThrow({ where: { reason: 'BRIBE' } })).toMatchObject({
      tick: 3,
      correlationId: corr,
      actorType: 'PLAYER',
      actorPlayerId: user.playerId,
    });
    // PLAYER without a player id violates the CHECK (bypassing the typed helper).
    await expect(
      app.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_journal_context(0, gen_random_uuid(), 'PLAYER', NULL)::text`;
        await bookMoney(tx, { playerId: user.playerId, account: 'CASH', amount: 1n, reason: 'ADMIN' });
      }),
    ).rejects.toThrow(/MoneyTransaction_actor_check/);
    await expect(
      app.prisma.$transaction((tx) => setJournalContext(tx, { tick: -1, actor: { type: 'SYSTEM' } })),
    ).rejects.toThrow(RangeError);
  });

  it('refuses TRUNCATE of a journal without app.allow_truncate (G-3c)', async () => {
    await expect(app.prisma.$executeRawUnsafe('TRUNCATE TABLE "MoneyTransaction" CASCADE')).rejects.toThrow(
      /append-only/,
    );
  });

  it('enforces the deletion status in the database (G-10a)', async () => {
    const user = await createUser(app);
    await expect(
      app.prisma.player.update({
        where: { id: user.playerId },
        data: { status: 'DELETED', deletedAt: new Date() },
      }),
    ).rejects.toThrow(/Player_user_iff_not_deleted/);
    await expect(
      app.prisma.player.update({ where: { id: user.playerId }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow(/Player_deletedAt_iff_deleted/);
  });
});

describe('all journals are append-only (ADR-010)', () => {
  it('rejects UPDATE and DELETE on every journal table', async () => {
    const { commodity } = await seedMarket();
    const user = await createUser(app);
    await addLot(app, user.playerId, commodity.id, 2);
    const clan = await createClan(app, 'JRN', [{ playerId: user.playerId, role: 'GODFATHER' }]);
    await inJournal(app, (tx) =>
      tx.clanTreasuryTransaction.create({
        data: { clanId: clan.id, account: 'CASH', amount: 1n, balanceAfter: 1n, reason: 'ADMIN' },
      }),
    );

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

    await inJournal(app, (tx) =>
      bookMoney(tx, {
        playerId: user.playerId,
        account: 'CASH',
        amount: -1n,
        reason: 'TRADE_BUY',
        refId: 't1',
      }),
    );
    await expect(
      inJournal(app, (tx) =>
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
