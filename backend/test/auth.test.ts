import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashRefreshToken } from '../src/lib/tokens.js';
import { createTestApp, register, truncateAll, validUser } from './helpers.js';

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

const login = (body: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: body });
const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: { refreshToken } });
const me = (accessToken?: string) =>
  app.inject({
    method: 'GET',
    url: '/api/v1/players/me',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });

describe('GET /api/v1/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: 'ok' });
  });
});

describe('POST /api/v1/auth/register', () => {
  it('creates a user with a player and returns tokens', async () => {
    const res = await register(app);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({
      email: 'dealer@example.com', // normalised to lower case
      username: 'TonyM',
      role: 'PLAYER',
      playerId: expect.any(String),
    });
    expect(body.user).not.toHaveProperty('passwordHash');

    const user = await app.prisma.user.findUniqueOrThrow({
      where: { email: 'dealer@example.com' },
      include: { player: true },
    });
    expect(user.passwordHash).not.toContain(validUser.password);
    expect(user.ageConfirmedAt).toBeInstanceOf(Date);
    expect(Date.now() - user.ageConfirmedAt.getTime()).toBeLessThan(60_000);
    expect(user.player).toMatchObject({ id: body.user.playerId, name: 'TonyM', status: 'IDLE' });

    // Only the hash of the refresh token is persisted.
    const stored = await app.prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashRefreshToken(body.refreshToken));
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    await register(app);
    const res = await register(app, { ...validUser, email: 'DEALER@example.com', username: 'Other' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a duplicate username (case-insensitive)', async () => {
    await register(app);
    const res = await register(app, { ...validUser, email: 'other@example.com', username: 'tonym' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USERNAME_TAKEN');
  });

  it.each([
    ['invalid email', { ...validUser, email: 'not-an-email' }],
    ['short password', { ...validUser, password: 'short' }],
    ['invalid username', { ...validUser, username: 'a b' }],
    ['missing fields', {}],
    ['missing age confirmation', { ...validUser, ageConfirmed: undefined }],
    ['age not confirmed', { ...validUser, ageConfirmed: false }],
    ['age confirmation as string', { ...validUser, ageConfirmed: 'true' }],
  ])('rejects %s with 400', async (_name, payload) => {
    const res = await register(app, payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await register(app);
  });

  it('logs in with email', async () => {
    const res = await login({ login: 'dealer@example.com', password: validUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toEqual(expect.any(String));
  });

  it('logs in with username (case-insensitive)', async () => {
    const res = await login({ login: 'tonym', password: validUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('TonyM');
  });

  it('returns the same 401 for a wrong password and an unknown user', async () => {
    const wrongPw = await login({ login: 'TonyM', password: 'wrong-password' });
    const unknown = await login({ login: 'nobody', password: 'wrong-password' });
    expect(wrongPw.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrongPw.json()).toEqual(unknown.json());
    expect(wrongPw.json().error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/v1/players/me', () => {
  it('requires a valid access token', async () => {
    expect((await me()).statusCode).toBe(401);
    const res = await me('garbage');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('returns the player profile with money as strings', async () => {
    const { accessToken, user } = (await register(app)).json();
    const res = await me(accessToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().player).toMatchObject({
      id: user.playerId,
      name: 'TonyM',
      cash: '0',
      bank: '0',
      health: 100,
      level: 1,
      status: 'IDLE',
      currentCity: null,
    });
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const first = (await register(app)).json();
    const res = await refresh(first.refreshToken);
    expect(res.statusCode).toBe(200);
    const second = res.json();
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect((await me(second.accessToken)).statusCode).toBe(200);

    const old = await app.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(first.refreshToken) },
    });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).not.toBeNull();
  });

  it('revokes every session when a used token is replayed', async () => {
    const first = (await register(app)).json();
    const second = (await refresh(first.refreshToken)).json();

    const replay = await refresh(first.refreshToken);
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('INVALID_REFRESH_TOKEN');

    // The legitimately rotated token is now revoked as well.
    expect((await refresh(second.refreshToken)).statusCode).toBe(401);
  });

  it('rejects unknown and expired tokens', async () => {
    expect((await refresh('does-not-exist')).statusCode).toBe(401);

    const { refreshToken } = (await register(app)).json();
    await app.prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('invalidates the refresh token', async () => {
    const { refreshToken } = (await register(app)).json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(204);
    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });
});

describe('error handling', () => {
  it('returns a uniform 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('rate limiting', () => {
  it('limits repeated auth requests', async () => {
    const limited = await createTestApp({ AUTH_RATE_LIMIT_MAX: '2' });
    try {
      const attempt = () =>
        limited.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { login: 'x', password: 'y' } });
      expect((await attempt()).statusCode).toBe(401);
      expect((await attempt()).statusCode).toBe(401);
      const blocked = await attempt();
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });
});
