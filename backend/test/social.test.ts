import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, truncateAll } from './helpers.js';
import { auth, createClan, createUser } from './fixtures.js';

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

const request = (method: 'GET' | 'POST', url: string, token?: string) =>
  app.inject({ method, url: `/api/v1${url}`, headers: token ? auth(token) : {} });

describe('authentication on game endpoints', () => {
  it.each([
    ['GET', '/players/me/transactions'],
    ['GET', '/players/online'],
    ['GET', '/cities'],
    ['GET', '/cities/berlin'],
    ['GET', '/cities/berlin/market'],
    ['GET', '/market/overview'],
    ['GET', '/inventory'],
    ['GET', '/vehicle-types'],
    ['GET', '/vehicles'],
    ['GET', '/equipment-types'],
    ['GET', '/equipment'],
    ['GET', '/travel/current'],
    ['GET', '/clans'],
    ['GET', '/clans/x'],
    ['GET', '/clan-invites'],
    ['GET', '/rankings'],
    ['GET', '/notifications'],
    ['POST', '/notifications/x/read'],
    ['POST', '/notifications/read-all'],
    ['GET', '/ticker'],
  ] as const)('%s %s requires a token', async (method, url) => {
    const res = await request(method, url);
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_ACCESS_TOKEN');
  });
});

describe('player profile & presence', () => {
  it('shows heat, xp placeholder and clan membership in /players/me', async () => {
    const u = await createUser(app, 'boss');
    const clan = await createClan(app, 'KOS', [{ playerId: u.playerId, role: 'GODFATHER' }]);
    const { player } = (await request('GET', '/players/me', u.token)).json();
    expect(player).toMatchObject({
      heat: 0,
      experienceForNextLevel: null,
      clanId: clan.id,
      clan: { id: clan.id, tag: 'KOS', name: 'Clan KOS', role: 'GODFATHER' },
    });
  });

  it('lists recently active players as online', async () => {
    const a = await createUser(app, 'alice');
    const b = await createUser(app, 'bob');
    await app.prisma.player.update({ where: { id: b.playerId }, data: { lastSeenAt: new Date(0) } });
    await createClan(app, 'ABC', [{ playerId: a.playerId, role: 'SOLDIER' }]);

    // Any authenticated request marks alice as seen.
    const res = await request('GET', '/players/online', a.token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      count: 1,
      players: [{ id: a.playerId, name: 'alice', level: 1, clanTag: 'ABC' }],
    });
  });

  it('pages the money ledger newest first', async () => {
    const u = await createUser(app);
    for (let i = 1; i <= 3; i++) {
      await app.prisma.moneyTransaction.create({
        data: {
          playerId: u.playerId,
          amount: BigInt(i * 100),
          balanceAfter: BigInt(i * 100),
          reason: 'ADMIN',
          createdAt: new Date(Date.now() + i * 1000),
        },
      });
    }
    const body = (await request('GET', '/players/me/transactions?limit=2', u.token)).json();
    expect(body).toMatchObject({ total: 3, limit: 2, offset: 0 });
    expect(body.items.map((t: { amount: string }) => t.amount)).toEqual(['300', '200']);

    const bad = await request('GET', '/players/me/transactions?limit=1000', u.token);
    expect(bad.statusCode).toBe(400);
  });
});

describe('clans', () => {
  it('lists clans with member counts', async () => {
    const a = await createUser(app);
    const b = await createUser(app);
    await createClan(app, 'ZZZ', [{ playerId: a.playerId, role: 'GODFATHER' }]);
    await createClan(app, 'AAA', [{ playerId: b.playerId, role: 'GODFATHER' }]);
    const body = (await request('GET', '/clans', a.token)).json();
    expect(body.total).toBe(2);
    expect(body.clans.map((c: { tag: string; memberCount: number }) => [c.tag, c.memberCount])).toEqual([
      ['AAA', 1],
      ['ZZZ', 1],
    ]);
  });

  it('sorts members by role hierarchy and hides the bank from outsiders', async () => {
    const soldier = await createUser(app, 'soldier');
    const boss = await createUser(app, 'boss');
    const capo = await createUser(app, 'capo');
    const outsider = await createUser(app, 'outsider');
    const clan = await createClan(
      app,
      'FAM',
      [
        { playerId: soldier.playerId, role: 'SOLDIER' },
        { playerId: boss.playerId, role: 'GODFATHER' },
        { playerId: capo.playerId, role: 'CAPO' },
      ],
      5000n,
    );

    const asMember = (await request('GET', `/clans/${clan.id}`, soldier.token)).json().clan;
    expect(asMember.bank).toBe('5000');
    expect(asMember.memberCount).toBe(3);
    expect(asMember.members.map((m: { role: string }) => m.role)).toEqual(['GODFATHER', 'CAPO', 'SOLDIER']);

    const asOutsider = (await request('GET', `/clans/${clan.id}`, outsider.token)).json().clan;
    expect(asOutsider.bank).toBeNull();

    const missing = await request('GET', '/clans/does-not-exist', outsider.token);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('CLAN_NOT_FOUND');
  });

  it('lists only own pending invites', async () => {
    const boss = await createUser(app, 'boss');
    const invitee = await createUser(app, 'invitee');
    const other = await createUser(app, 'other');
    const clan = await createClan(app, 'INV', [{ playerId: boss.playerId, role: 'GODFATHER' }]);
    await app.prisma.clanInvite.createMany({
      data: [
        { clanId: clan.id, playerId: invitee.playerId, invitedById: boss.playerId },
        { clanId: clan.id, playerId: other.playerId, invitedById: boss.playerId },
        { clanId: clan.id, playerId: invitee.playerId, status: 'DECLINED' },
      ],
    });
    const { invites } = (await request('GET', '/clan-invites', invitee.token)).json();
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ clan: { tag: 'INV' }, invitedBy: { name: 'boss' } });
  });

  it('allows only one pending invite per clan and player', async () => {
    const boss = await createUser(app);
    const invitee = await createUser(app);
    const clan = await createClan(app, 'ONE', [{ playerId: boss.playerId, role: 'GODFATHER' }]);
    await app.prisma.clanInvite.create({ data: { clanId: clan.id, playerId: invitee.playerId } });
    await expect(
      app.prisma.clanInvite.create({ data: { clanId: clan.id, playerId: invitee.playerId } }),
    ).rejects.toThrow();
  });
});

describe('rankings', () => {
  async function seedPlayers() {
    const rich = await createUser(app, 'rich');
    const famous = await createUser(app, 'famous');
    const veteran = await createUser(app, 'veteran');
    await app.prisma.player.update({
      where: { id: rich.playerId },
      data: { cash: 5_000_000_000n, bank: 1n },
    });
    await app.prisma.player.update({ where: { id: famous.playerId }, data: { reputation: 999, cash: 10n } });
    await app.prisma.player.update({ where: { id: veteran.playerId }, data: { level: 30, experience: 5 } });
    await createClan(app, 'RCH', [{ playerId: rich.playerId, role: 'GODFATHER' }], 100n);
    await createClan(app, 'FAM', [{ playerId: famous.playerId, role: 'GODFATHER' }], 1000n);
    return rich;
  }

  it.each([
    ['wealth', 'rich', '5000000001'],
    ['reputation', 'famous', '999'],
    ['level', 'veteran', '30'],
  ])('ranks players by %s', async (type, leader, value) => {
    const { token } = await seedPlayers();
    const body = (await request('GET', `/rankings?type=${type}`, token)).json();
    expect(body).toMatchObject({ type, total: 3, offset: 0 });
    expect(body.entries[0]).toMatchObject({ rank: 1, player: { name: leader }, value });
    expect(body.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3]);
  });

  it('includes the clan tag and supports offset', async () => {
    const { token } = await seedPlayers();
    const body = (await request('GET', '/rankings?type=wealth&limit=1&offset=0', token)).json();
    expect(body.entries).toEqual([
      { rank: 1, player: expect.objectContaining({ name: 'rich', clanTag: 'RCH' }), value: '5000000001' },
    ]);
    const second = (await request('GET', '/rankings?type=wealth&limit=1&offset=1', token)).json();
    expect(second.entries[0]).toMatchObject({ rank: 2, player: { name: 'famous' } });
  });

  it('ranks clans by bank plus member wealth', async () => {
    const { token } = await seedPlayers();
    const body = (await request('GET', '/rankings?type=clans', token)).json();
    expect(body.total).toBe(2);
    expect(body.entries[0]).toEqual({
      rank: 1,
      clan: expect.objectContaining({ tag: 'RCH', memberCount: 1 }),
      value: '5000000101',
    });
    expect(body.entries[1]).toMatchObject({ clan: { tag: 'FAM' }, value: '1010' });
  });

  it('rejects unknown ranking types', async () => {
    const { token } = await createUser(app);
    const res = await request('GET', '/rankings?type=cheaters', token);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('notifications', () => {
  it('lists own notifications and marks them read', async () => {
    const me = await createUser(app);
    const other = await createUser(app);
    const [n1] = await Promise.all([
      app.prisma.notification.create({
        data: {
          playerId: me.playerId,
          type: 'TRAVEL_ARRIVED',
          title: 'Angekommen',
          body: 'Du bist in Hamburg.',
        },
      }),
      app.prisma.notification.create({
        data: { playerId: me.playerId, type: 'CLAN_INVITE', title: 'Einladung', body: '…' },
      }),
    ]);
    const foreign = await app.prisma.notification.create({
      data: { playerId: other.playerId, type: 'X', title: 'X', body: 'X' },
    });

    const list = (await request('GET', '/notifications', me.token)).json();
    expect(list).toMatchObject({ total: 2, unreadCount: 2 });

    const read = await request('POST', `/notifications/${n1.id}/read`, me.token);
    expect(read.statusCode).toBe(200);
    expect(read.json().notification.readAt).not.toBeNull();
    // Idempotent
    expect((await request('POST', `/notifications/${n1.id}/read`, me.token)).statusCode).toBe(200);

    const unread = (await request('GET', '/notifications?unreadOnly=true', me.token)).json();
    expect(unread).toMatchObject({ total: 1, unreadCount: 1 });

    const foreignRes = await request('POST', `/notifications/${foreign.id}/read`, me.token);
    expect(foreignRes.statusCode).toBe(404);

    const all = (await request('POST', '/notifications/read-all', me.token)).json();
    expect(all).toEqual({ updated: 1 });
    expect((await request('GET', '/notifications', me.token)).json().unreadCount).toBe(0);

    // The other player's notification is untouched.
    const otherList = (await request('GET', '/notifications', other.token)).json();
    expect(otherList.unreadCount).toBe(1);
  });
});

describe('ticker', () => {
  it('returns the latest public events, newest first', async () => {
    const { token } = await createUser(app);
    await app.prisma.tickerEvent.createMany({
      data: [
        { type: 'TRAVEL', message: 'old', createdAt: new Date(1000) },
        { type: 'TRAVEL', message: 'new', createdAt: new Date(2000) },
      ],
    });
    const body = (await request('GET', '/ticker?limit=1', token)).json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ type: 'TRAVEL', message: 'new' });
  });
});
