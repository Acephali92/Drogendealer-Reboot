import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, truncateAll } from './helpers.js';
import { auth, createClan, createCity, createCommodity, createUser } from './fixtures.js';

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

const PASSWORD = 'password-123'; // see fixtures.createUser

const exportData = (token?: string) =>
  app.inject({ method: 'GET', url: '/api/v1/players/me/export', headers: token ? auth(token) : {} });
const deleteAccount = (token: string | undefined, payload: unknown) =>
  app.inject({
    method: 'DELETE',
    url: '/api/v1/players/me',
    headers: token ? auth(token) : {},
    payload: payload as Record<string, unknown>,
  });

describe('GET /api/v1/players/me/export', () => {
  it('requires authentication', async () => {
    expect((await exportData()).statusCode).toBe(401);
  });

  it('exports all own data as a downloadable JSON without secrets', async () => {
    const me = await createUser(app, 'exporter');
    const city = await createCity(app, { slug: 'berlin', name: 'Berlin' });
    const weed = await createCommodity(app, 'weed');
    await app.prisma.inventoryItem.create({
      data: { playerId: me.playerId, commodityId: weed.id, quantity: 3, avgBuyPrice: 50n },
    });
    await app.prisma.moneyTransaction.create({
      data: { playerId: me.playerId, amount: -150n, balanceAfter: 0n, reason: 'TRADE' },
    });
    await app.prisma.notification.create({
      data: { playerId: me.playerId, type: 'X', title: 'Hallo', body: 'Welt' },
    });
    await app.prisma.player.update({ where: { id: me.playerId }, data: { currentCityId: city.id } });

    const res = await exportData(me.token);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="drogendealer-export-/);
    expect(res.headers['cache-control']).toBe('no-store');

    const body = res.json();
    expect(body.formatVersion).toBe(1);
    expect(body.account).toMatchObject({
      email: 'exporter@example.com',
      username: 'exporter',
      ageConfirmedAt: expect.any(String),
    });
    expect(body.sessions).toHaveLength(1);
    expect(body.player).toMatchObject({ name: 'exporter', currentCityId: city.id });
    expect(body.player.inventory[0]).toMatchObject({ quantity: 3, avgBuyPrice: '50', commodity: { slug: 'weed' } });
    expect(body.player.moneyTransactions[0]).toMatchObject({ amount: '-150', reason: 'TRADE' });
    expect(body.player.notifications).toHaveLength(1);

    expect(res.body).not.toContain('passwordHash');
    expect(res.body).not.toContain('tokenHash');
    expect(res.body).not.toContain('$argon2');
  });
});

describe('DELETE /api/v1/players/me', () => {
  it('requires authentication and the correct password', async () => {
    const me = await createUser(app);
    expect((await deleteAccount(undefined, { password: PASSWORD })).statusCode).toBe(401);
    expect((await deleteAccount(me.token, {})).statusCode).toBe(400);

    const wrong = await deleteAccount(me.token, { password: 'wrong-password' });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe('INVALID_PASSWORD');
    expect(await app.prisma.user.count()).toBe(1);
  });

  it('deletes the account with all personal data and blocks further use', async () => {
    const me = await createUser(app, 'leaver');
    const other = await createUser(app, 'stayer');
    const { refreshToken } = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { login: 'leaver', password: PASSWORD },
      })
    ).json();
    await app.prisma.notification.create({ data: { playerId: me.playerId, type: 'X', title: 'X', body: 'X' } });
    await app.prisma.message.create({ data: { senderId: me.playerId, recipientId: other.playerId, body: 'Hi' } });

    const res = await deleteAccount(me.token, { password: PASSWORD });
    expect(res.statusCode).toBe(204);

    expect(await app.prisma.user.findUnique({ where: { id: me.userId } })).toBeNull();
    expect(await app.prisma.player.findUnique({ where: { id: me.playerId } })).toBeNull();
    expect(await app.prisma.refreshToken.count({ where: { userId: me.userId } })).toBe(0);
    expect(await app.prisma.notification.count({ where: { playerId: me.playerId } })).toBe(0);

    // The recipient keeps the message, but the sender is anonymised.
    const msg = await app.prisma.message.findFirstOrThrow({ where: { recipientId: other.playerId } });
    expect(msg.senderId).toBeNull();

    // Old sessions are gone; the still-valid access token finds no player any more.
    const refresh = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken } });
    expect(refresh.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/players/me', headers: auth(me.token) })).statusCode).toBe(404);

    // Username and email become available again.
    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'leaver@example.com', username: 'leaver', password: PASSWORD, ageConfirmed: true },
    });
    expect(again.statusCode).toBe(201);
  });

  it('removes a clan that has no members left, but keeps clans with other members', async () => {
    const solo = await createUser(app);
    const boss = await createUser(app);
    const soldier = await createUser(app);
    const soloClan = await createClan(app, 'SOL', [{ playerId: solo.playerId, role: 'GODFATHER' }]);
    const bigClan = await createClan(app, 'BIG', [
      { playerId: boss.playerId, role: 'GODFATHER' },
      { playerId: soldier.playerId, role: 'SOLDIER' },
    ]);

    expect((await deleteAccount(solo.token, { password: PASSWORD })).statusCode).toBe(204);
    expect((await deleteAccount(soldier.token, { password: PASSWORD })).statusCode).toBe(204);

    expect(await app.prisma.clan.findUnique({ where: { id: soloClan.id } })).toBeNull();
    const remaining = await app.prisma.clan.findUniqueOrThrow({
      where: { id: bigClan.id },
      include: { members: true },
    });
    expect(remaining.members.map((m) => m.playerId)).toEqual([boss.playerId]);
  });
});
