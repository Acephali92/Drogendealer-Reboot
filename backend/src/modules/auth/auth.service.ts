import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { conflict, unauthorized } from '../../lib/errors.js';
import { getDummyHash, hashPassword, verifyPassword } from '../../lib/password.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/tokens.js';
import type { AccessTokenPayload } from '../../plugins/auth.js';
import { createPlayerForUser } from '../player/player.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  signAccessToken: (payload: AccessTokenPayload) => string;
  refreshTokenTtlDays: number;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: User['role'];
  playerId: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

type UserWithPlayer = User & { player: { id: string } | null };

const invalidCredentials = () =>
  unauthorized('INVALID_CREDENTIALS', 'Invalid login or password');
const invalidRefreshToken = () =>
  unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

export function createAuthService({ prisma, signAccessToken, refreshTokenTtlDays }: AuthServiceDeps) {
  const refreshExpiry = () => new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  async function issueTokens(
    db: Prisma.TransactionClient,
    user: UserWithPlayer,
    meta: ClientMeta,
  ): Promise<AuthResult & { refreshTokenId: string }> {
    if (!user.player) {
      // Every account gets a player on registration; a missing one is a data error.
      throw new Error(`User ${user.id} has no player`);
    }
    const refreshToken = generateRefreshToken();
    const record = await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(),
        userAgent: meta.userAgent?.slice(0, 512),
        ip: meta.ip,
      },
      select: { id: true },
    });
    const accessToken = signAccessToken({ sub: user.id, pid: user.player.id, role: user.role });
    return {
      accessToken,
      refreshToken,
      refreshTokenId: record.id,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        playerId: user.player.id,
      },
    };
  }

  const strip = ({ refreshTokenId: _ignored, ...result }: AuthResult & { refreshTokenId: string }) =>
    result;

  async function assertAvailable(email: string, username: string) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: { equals: username, mode: 'insensitive' } }],
      },
      select: { email: true },
    });
    if (existing) {
      throw existing.email === email
        ? conflict('EMAIL_TAKEN', 'This email address is already registered')
        : conflict('USERNAME_TAKEN', 'This username is already taken');
    }
    const playerName = await prisma.player.findFirst({
      where: { name: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (playerName) throw conflict('USERNAME_TAKEN', 'This username is already taken');
  }

  return {
    async register(input: RegisterInput, meta: ClientMeta): Promise<AuthResult> {
      await assertAvailable(input.email, input.username);
      const passwordHash = await hashPassword(input.password);

      try {
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email: input.email, username: input.username, passwordHash, lastLoginAt: new Date() },
          });
          const player = await createPlayerForUser(tx, user.id, input.username);
          return issueTokens(tx, { ...user, player }, meta);
        });
        return strip(result);
      } catch (err) {
        // Lost a race against a concurrent registration with the same email/username.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw conflict('ACCOUNT_EXISTS', 'Email address or username is already taken');
        }
        throw err;
      }
    },

    async login(input: LoginInput, meta: ClientMeta): Promise<AuthResult> {
      const login = input.login;
      const user = await prisma.user.findFirst({
        where: login.includes('@')
          ? { email: login.toLowerCase() }
          : { username: { equals: login, mode: 'insensitive' } },
        include: { player: { select: { id: true } } },
      });

      if (!user) {
        // Spend comparable time so response timing does not reveal whether the account exists.
        await verifyPassword(await getDummyHash(), input.password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) {
        throw invalidCredentials();
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return issueTokens(tx, user, meta);
      });
      return strip(result);
    },

    /**
     * Rotates a refresh token: the presented token is revoked and a new pair is issued.
     * Presenting an already revoked token is treated as theft → all sessions of the user are revoked.
     */
    async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthResult> {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        include: { user: { include: { player: { select: { id: true } } } } },
      });
      if (!stored) throw invalidRefreshToken();

      if (stored.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw invalidRefreshToken();
      }
      if (stored.expiresAt <= new Date()) throw invalidRefreshToken();

      const result = await prisma.$transaction(async (tx) => {
        // Conditional revoke guards against two concurrent refreshes with the same token.
        const revoked = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (revoked.count !== 1) throw invalidRefreshToken();

        const issued = await issueTokens(tx, stored.user, meta);
        await tx.refreshToken.update({
          where: { id: stored.id },
          data: { replacedById: issued.refreshTokenId },
        });
        return issued;
      });
      return strip(result);
    },

    async logout(refreshToken: string): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
