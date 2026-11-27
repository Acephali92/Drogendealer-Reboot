import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DELETED_MESSAGE_TEXT, pseudonymFor } from '../src/modules/account/account.service.js';
import { bookMoney } from '../src/modules/money/ledger.js';
import { createTestApp, truncateAll } from './helpers.js';
import {
  addLot,
  auth,
  createClan,
  createCity,
  createCommodity,
  createUser,
  createVehicleType,
  inJournal,
  TEST_PASSWORD as PASSWORD,
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

const exportData = (token?: string) =>
  app.inject({ method: 'GET', url: '/api/v1/players/me/export', headers: token ? auth(token) : {} });
const deleteAccount = (token: string | undefined, payload: unknown) =>
  app.inject({
    method: 'DELETE',
    url: '/api/v1/players/me',
    headers: token ? auth(token) : {},
    payload: payload as Record<string, unknown>,
  });

/** Invariant M-1 / I-1 (docs/database/DATA_MODEL.md): projection = Σ journal per player and account / good. */
async function expectJournalsConsistent(playerId: string) {
  const player = await app.prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const money = await app.prisma.moneyTransaction.groupBy({
    by: ['account'],
    where: { playerId },
    _sum: { amount: true },
  });
  const sum = (account: 'CASH' | 'BANK') => money.find((m) => m.account === account)?._sum.amount ?? 0n;
  expect(sum('CASH')).toBe(player.cash);
  expect(sum('BANK')).toBe(player.bank);

  const movements = await app.prisma.inventoryMovement.groupBy({
    by: ['commodityId'],
    where: { playerId },
    _sum: { delta: true },
  });
  for (const m of movements) {
    const lots = await app.prisma.inventoryLot.aggregate({
      where: { playerId, commodityId: m.commodityId },
      _sum: { quantity: true },
    });
    expect(m._sum.delta ?? 0).toBe(lots._sum.quantity ?? 0);
  }
}

describe('GET /api/v1/players/me/export', () => {
  it('requires authentication', async () => {
    expect((await exportData()).statusCode).toBe(401);
  });

  it('exports all own data as a downloadable JSON without secrets', async () => {
    const me = await createUser(app, 'exporter');
    const city = await createCity(app, 'berlin');
    const gras = await createCommodity(app, 'gras');
    await addLot(app, me.playerId, gras.id, 3, 150n);
    await app.prisma.notification.create({
      data: { playerId: me.playerId, type: 'X', title: 'Hallo', body: 'Welt' },
    });
    await app.prisma.player.update({ where: { id: me.playerId }, data: { currentCityId: city.id } });

    const res = await exportData(me.token);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="drogendealer-export-/);
    expect(res.headers['cache-control']).toBe('no-store');

    const body = res.json();
    expect(body.formatVersion).toBe(3);
    expect(body.account).toMatchObject({
      email: 'exporter@example.com',
      username: 'exporter',
      ageConfirmedAt: expect.any(String),
    });
    expect(body.sessions).toHaveLength(1);
    expect(body.player).toMatchObject({ name: 'exporter', currentCity: { slug: 'berlin' } });
    expect(body.player.inventoryLots[0]).toMatchObject({
      quantity: 3,
      costBasis: '150',
      commodity: { slug: 'gras' },
    });
    expect(body.player.inventoryMovements[0]).toMatchObject({ delta: 3, commodity: { slug: 'gras' } });
    expect(body.player.moneyTransactions[0]).toMatchObject({
      account: 'CASH',
      reason: 'START_CAPITAL',
      seq: expect.any(String),
      tick: 0,
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      actorType: 'SYSTEM',
      actorPlayerId: null,
    });
    expect(body.player.notifications).toHaveLength(1);

    expect(res.body).not.toContain('passwordHash');
    expect(res.body).not.toContain('tokenHash');
    expect(res.body).not.toContain('$argon2');
  });
});

describe('DELETE /api/v1/players/me (ADR-017: pseudonymise, keep journals)', () => {
  it('requires authentication and the correct password', async () => {
    const me = await createUser(app);
    expect((await deleteAccount(undefined, { password: PASSWORD })).statusCode).toBe(401);
    expect((await deleteAccount(me.token, {})).statusCode).toBe(400);

    const wrong = await deleteAccount(me.token, { password: 'wrong-password' });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe('INVALID_PASSWORD');
    expect(await app.prisma.user.count()).toBe(1);
  });

  it('removes personal data, keeps a pseudonymised player and forfeits assets via the journals', async () => {
    const me = await createUser(app, 'leaver');
    const other = await createUser(app, 'stayer');
    const { refreshToken } = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { login: 'leaver', password: PASSWORD },
      })
    ).json();
    const gras = await createCommodity(app, 'gras');
    await addLot(app, me.playerId, gras.id, 7, 700n);
    const kleinwagen = await createVehicleType(app, 'kleinwagen');
    await app.prisma.vehicle.create({
      data: { playerId: me.playerId, vehicleTypeId: kleinwagen.id, isActive: true },
    });
    await app.prisma.notification.create({
      data: { playerId: me.playerId, type: 'X', title: 'X', body: 'X' },
    });
    await app.prisma.message.create({
      data: { senderId: me.playerId, recipientId: other.playerId, body: 'Hi' },
    });
    await app.prisma.message.create({
      data: { senderId: other.playerId, recipientId: me.playerId, body: 'Yo' },
    });
    const startCash = (await app.prisma.player.findUniqueOrThrow({ where: { id: me.playerId } })).cash;
    expect(startCash).toBe(app.gameParams.player.start_cash_black);

    expect((await deleteAccount(me.token, { password: PASSWORD })).statusCode).toBe(204);

    // Personal data is gone.
    expect(await app.prisma.user.findUnique({ where: { id: me.userId } })).toBeNull();
    expect(await app.prisma.refreshToken.count({ where: { userId: me.userId } })).toBe(0);
    expect(await app.prisma.notification.count({ where: { playerId: me.playerId } })).toBe(0);
    expect(await app.prisma.message.count({ where: { recipientId: me.playerId } })).toBe(0);
    const sent = await app.prisma.message.findFirstOrThrow({ where: { recipientId: other.playerId } });
    expect(sent).toMatchObject({ senderId: me.playerId, body: DELETED_MESSAGE_TEXT, subject: null });

    // The player stays as a pseudonymised actor, without assets.
    const player = await app.prisma.player.findUniqueOrThrow({ where: { id: me.playerId } });
    expect(player).toMatchObject({
      userId: null,
      name: pseudonymFor(me.playerId),
      status: 'DELETED',
      cash: 0n,
      bank: 0n,
    });
    expect(player.name).not.toContain('leaver');
    expect(await app.prisma.inventoryLot.count({ where: { playerId: me.playerId } })).toBe(0);
    expect(await app.prisma.vehicle.count({ where: { playerId: me.playerId } })).toBe(0);

    // Journals are complete: start capital and forfeiture are both booked, Σ journal = projection.
    const money = await app.prisma.moneyTransaction.findMany({
      where: { playerId: me.playerId },
      orderBy: { seq: 'asc' },
    });
    expect(money.map((m) => [m.account, m.reason, m.amount])).toEqual([
      ['CASH', 'START_CAPITAL', startCash],
      ['CASH', 'ACCOUNT_DELETION', -startCash],
    ]);
    const goods = await app.prisma.inventoryMovement.findMany({
      where: { playerId: me.playerId },
      orderBy: { seq: 'asc' },
    });
    expect(goods.map((g) => [g.delta, g.quantityAfter, g.reason])).toEqual([
      [7, 7, 'ADMIN'],
      [-7, 0, 'ACCOUNT_DELETION'],
    ]);
    await expectJournalsConsistent(me.playerId);

    // The deletion is one action of the player: one correlationId across all journals (TD-022).
    const deletionRows = [money.at(-1)!, goods.at(-1)!];
    expect(new Set(deletionRows.map((r) => r.correlationId)).size).toBe(1);
    for (const r of deletionRows) {
      expect(r).toMatchObject({ tick: 0, actorType: 'PLAYER', actorPlayerId: me.playerId });
    }
    expect(money[0]!.correlationId).not.toBe(money.at(-1)!.correlationId);

    // Sessions and the access token are useless now.
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/players/me', headers: auth(me.token) })).statusCode,
    ).toBe(404);

    // Username and email become available again.
    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'leaver@example.com', username: 'leaver', password: PASSWORD, ageConfirmed: true },
    });
    expect(again.statusCode).toBe(201);
  });

  it('hides deleted players from rankings and the online list', async () => {
    const me = await createUser(app, 'ghost');
    const other = await createUser(app, 'alive');
    await deleteAccount(me.token, { password: PASSWORD });
    const ranking = (
      await app.inject({ method: 'GET', url: '/api/v1/rankings?type=wealth', headers: auth(other.token) })
    ).json();
    expect(ranking.total).toBe(1);
    expect(ranking.entries.map((e: { player: { name: string } }) => e.player.name)).toEqual(['alive']);
  });

  it('dissolves a clan without members (treasury forfeited), keeps clans with other members', async () => {
    const solo = await createUser(app);
    const boss = await createUser(app);
    const soldier = await createUser(app);
    const soloClan = await createClan(app, 'SOL', [{ playerId: solo.playerId, role: 'GODFATHER' }]);
    // A deposit is one action of the player with both sides (X-04: Σ per correlationId = 0).
    await inJournal(
      app,
      async (tx) => {
        await bookMoney(tx, {
          playerId: solo.playerId,
          account: 'CASH',
          amount: -500n,
          reason: 'CLAN_DEPOSIT',
        });
        await tx.clanTreasuryTransaction.create({
          data: {
            clanId: soloClan.id,
            playerId: solo.playerId,
            account: 'CASH',
            amount: 500n,
            balanceAfter: 500n,
            reason: 'DEPOSIT',
          },
        });
        await tx.clan.update({ where: { id: soloClan.id }, data: { treasuryCash: 500n } });
      },
      { actor: { type: 'PLAYER', playerId: solo.playerId } },
    );
    const bigClan = await createClan(app, 'BIG', [
      { playerId: boss.playerId, role: 'GODFATHER' },
      { playerId: soldier.playerId, role: 'SOLDIER' },
    ]);

    expect((await deleteAccount(solo.token, { password: PASSWORD })).statusCode).toBe(204);
    expect((await deleteAccount(soldier.token, { password: PASSWORD })).statusCode).toBe(204);

    const dissolved = await app.prisma.clan.findUniqueOrThrow({ where: { id: soloClan.id } });
    expect(dissolved.dissolvedAt).not.toBeNull();
    expect(dissolved.treasuryCash).toBe(0n);
    const treasury = await app.prisma.clanTreasuryTransaction.aggregate({
      where: { clanId: soloClan.id },
      _sum: { amount: true },
    });
    expect(treasury._sum.amount).toBe(0n); // deposit + dissolution = projection 0

    const remaining = await app.prisma.clan.findUniqueOrThrow({
      where: { id: bigClan.id },
      include: { members: true },
    });
    expect(remaining.dissolvedAt).toBeNull();
    expect(remaining.members.map((m) => m.playerId)).toEqual([boss.playerId]);

    const clans = (
      await app.inject({ method: 'GET', url: '/api/v1/clans', headers: auth(boss.token) })
    ).json();
    expect(clans.clans.map((c: { tag: string }) => c.tag)).toEqual(['BIG']);
  });
});
