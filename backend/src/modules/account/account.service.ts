import type { Prisma, PrismaClient } from '@prisma/client';
import { sha256Hex } from '../../domain/index.js';
import { AppError, notFound } from '../../lib/errors.js';
import { verifyPassword } from '../../lib/password.js';
import { serialize } from '../../lib/serialize.js';
import { bookMoney } from '../money/ledger.js';

const slug = { select: { slug: true } } as const;

/**
 * GDPR-style export (Art. 15/20): everything stored about the account, as JSON.
 * Secrets (password hash, refresh token hashes) are deliberately excluded.
 * Catalog entries are exported by technical key; display names live in parameters.toml.
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
          currentCity: slug,
          heat: { include: { city: slug } },
          inventoryLots: { include: { commodity: slug }, orderBy: { acquiredAt: 'asc' } },
          inventoryMovements: { include: { commodity: slug }, orderBy: { createdAt: 'asc' } },
          tradeTransactions: { orderBy: { createdAt: 'asc' } },
          moneyTransactions: { orderBy: { createdAt: 'asc' } },
          vehicles: { include: { vehicleType: slug } },
          travels: { orderBy: { departedAt: 'asc' } },
          equipment: { include: { equipmentType: { select: { slug: true, slot: true } } } },
          attacks: { orderBy: { createdAt: 'asc' } },
          defenses: { orderBy: { createdAt: 'asc' } },
          clanMembership: { include: { clan: { select: { id: true, name: true, tag: true } } } },
          clanInvites: { orderBy: { createdAt: 'asc' } },
          sentClanInvites: { orderBy: { createdAt: 'asc' } },
          clanTreasuryTxs: { orderBy: { createdAt: 'asc' } },
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
    formatVersion: 2,
    account,
    sessions: refreshTokens,
    player,
  });
}

/** Display name of a deleted player: stable, not reversible, no personal data (ADR-017). */
export function pseudonymFor(playerId: string): string {
  return `Gelöschter Spieler #${sha256Hex(`deleted-player:${playerId}`).slice(0, 10)}`;
}

/** Placeholder for the content of messages sent by a deleted player. */
export const DELETED_MESSAGE_TEXT = '[gelöscht]';

/**
 * Deletes an account per ADR-017 (`account.deletion_policy = "forfeit"`, game design README §7.1):
 * - personal data goes: user (email, username, password hash, age confirmation), sessions incl.
 *   IP/user agent, notifications, received messages and invites, content of sent messages;
 * - the player stays as a pseudonymised actor (status DELETED) so that money, trade, inventory,
 *   travel and combat journals remain complete and consistent (ADR-010);
 * - money, goods, vehicles and equipment are forfeited; money and goods are booked out through
 *   their journals (reason ACCOUNT_DELETION), so Σ journal = projection still holds;
 * - a clan left without members is dissolved and its treasury forfeited (DISSOLUTION).
 * Requires the current password.
 */
export async function deleteAccount(prisma: PrismaClient, userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, player: { select: { id: true } } },
  });
  if (!user) throw notFound('ACCOUNT_NOT_FOUND', 'Account does not exist');
  if (!(await verifyPassword(user.passwordHash, password))) {
    // 403, not 401: the access token is valid, only the confirmation failed.
    throw new AppError(403, 'INVALID_PASSWORD', 'Password confirmation failed');
  }

  await prisma.$transaction(async (tx) => {
    if (user.player) await forfeitPlayer(tx, user.player.id);
    await tx.user.delete({ where: { id: userId } }); // sessions cascade, Player.userId → null
  });
}

async function forfeitPlayer(tx: Prisma.TransactionClient, playerId: string) {
  const player = await tx.player.findUniqueOrThrow({
    where: { id: playerId },
    select: {
      cash: true,
      bank: true,
      inventoryLots: { select: { commodityId: true, quantity: true } },
      clanMembership: { select: { clanId: true } },
    },
  });

  // Money: book the balances out, the journal stays complete.
  await bookMoney(tx, { playerId, account: 'CASH', amount: -player.cash, reason: 'ACCOUNT_DELETION' });
  await bookMoney(tx, { playerId, account: 'BANK', amount: -player.bank, reason: 'ACCOUNT_DELETION' });

  // Goods: one outgoing movement per good, then the lots go (goods do not return to markets).
  const perGood = new Map<string, number>();
  for (const lot of player.inventoryLots) {
    perGood.set(lot.commodityId, (perGood.get(lot.commodityId) ?? 0) + lot.quantity);
  }
  for (const [commodityId, quantity] of perGood) {
    if (quantity > 0) {
      await tx.inventoryMovement.create({
        data: { playerId, commodityId, delta: -quantity, quantityAfter: 0, reason: 'ACCOUNT_DELETION' },
      });
    }
  }
  await tx.inventoryLot.deleteMany({ where: { playerId } });

  // Assets and personal/social data without journal.
  await tx.vehicle.deleteMany({ where: { playerId } });
  await tx.playerEquipment.deleteMany({ where: { playerId } });
  await tx.playerCityHeat.deleteMany({ where: { playerId } });
  await tx.notification.deleteMany({ where: { playerId } });
  await tx.message.deleteMany({ where: { recipientId: playerId } });
  await tx.message.updateMany({
    where: { senderId: playerId },
    data: { subject: null, body: DELETED_MESSAGE_TEXT },
  });
  await tx.clanInvite.deleteMany({ where: { playerId } });

  // Clan: leave; an empty clan is dissolved and its treasury forfeited.
  const clanId = player.clanMembership?.clanId;
  if (clanId) {
    await tx.clanMember.delete({ where: { playerId } });
    const remaining = await tx.clanMember.count({ where: { clanId } });
    if (remaining === 0) await dissolveClan(tx, clanId);
  }

  await tx.player.update({
    where: { id: playerId },
    data: {
      name: pseudonymFor(playerId),
      status: 'DELETED',
      deletedAt: new Date(),
      currentCityId: null,
      lastSeenAt: null,
      statusUntil: null,
    },
  });
}

async function dissolveClan(tx: Prisma.TransactionClient, clanId: string) {
  const clan = await tx.clan.findUniqueOrThrow({
    where: { id: clanId },
    select: { treasuryCash: true, treasuryBank: true },
  });
  for (const [account, balance] of [
    ['CASH', clan.treasuryCash],
    ['BANK', clan.treasuryBank],
  ] as const) {
    if (balance !== 0n) {
      await tx.clanTreasuryTransaction.create({
        data: { clanId, account, amount: -balance, balanceAfter: 0n, reason: 'DISSOLUTION' },
      });
    }
  }
  await tx.clanInvite.deleteMany({ where: { clanId } });
  await tx.clan.update({
    where: { id: clanId },
    data: { treasuryCash: 0n, treasuryBank: 0n, dissolvedAt: new Date() },
  });
}
