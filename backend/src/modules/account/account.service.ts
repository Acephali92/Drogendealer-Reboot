import type { PrismaClient } from '@prisma/client';
import { AppError, notFound } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import { serialize } from '../../lib/serialize.js';

/**
 * GDPR-style export (Art. 15/20): everything stored about the account, as JSON.
 * Secrets (password hash, refresh token hashes) are deliberately excluded.
 */
export async function exportAccountData(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      ageConfirmedAt: true,
      refreshTokens: {
        select: { createdAt: true, expiresAt: true, revokedAt: true, ip: true, userAgent: true },
        orderBy: { createdAt: 'asc' },
      },
      player: {
        include: {
          inventory: { include: { commodity: { select: { slug: true, name: true } } } },
          tradeTransactions: { orderBy: { createdAt: 'asc' } },
          moneyTransactions: { orderBy: { createdAt: 'asc' } },
          vehicles: { include: { vehicleType: { select: { slug: true, name: true } } } },
          travels: { orderBy: { departedAt: 'asc' } },
          equipment: { include: { equipmentType: { select: { slug: true, name: true } } } },
          attacks: { orderBy: { createdAt: 'asc' } },
          defenses: { orderBy: { createdAt: 'asc' } },
          clanMembership: { include: { clan: { select: { id: true, name: true, tag: true } } } },
          clanInvites: { orderBy: { createdAt: 'asc' } },
          sentClanInvites: { orderBy: { createdAt: 'asc' } },
          sentMessages: { orderBy: { createdAt: 'asc' } },
          receivedMessages: { orderBy: { createdAt: 'asc' } },
          notifications: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!user) throw notFound('ACCOUNT_NOT_FOUND', 'Account does not exist');

  const { refreshTokens, player, ...account } = user;
  return serialize({
    exportedAt: new Date(),
    formatVersion: 1,
    account,
    sessions: refreshTokens,
    player,
  });
}

/**
 * Permanently deletes the account and all personal game data (cascade via foreign keys).
 * Requires the current password. Clans left without any member are removed as well.
 *
 * Effects on other players (by design of the foreign keys):
 * - combats with this player disappear from their history,
 * - messages/invites sent by this player remain, with the sender set to null.
 */
export async function deleteAccount(prisma: PrismaClient, userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      player: { select: { clanMembership: { select: { clanId: true } } } },
    },
  });
  if (!user) throw notFound('ACCOUNT_NOT_FOUND', 'Account does not exist');
  if (!(await verifyPassword(user.passwordHash, password))) {
    // 403, not 401: the access token is valid, only the confirmation failed.
    throw new AppError(403, 'INVALID_PASSWORD', 'Password confirmation failed');
  }

  const clanId = user.player?.clanMembership?.clanId;
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } });
    if (clanId) {
      await tx.clan.deleteMany({ where: { id: clanId, members: { none: {} } } });
    }
  });
}
