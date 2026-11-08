import type { Prisma, PrismaClient } from '@prisma/client';
import { notFound } from '../../lib/errors.js';
import { serialize } from '../../lib/serialize.js';

/**
 * Start values for newly registered players.
 * PLACEHOLDER: the concrete numbers are a game-design decision and will be
 * replaced once the game designer has defined the starting conditions.
 */
export const PLAYER_START_VALUES = {
  cash: 0n,
  bank: 0n,
  health: 100,
  maxHealth: 100,
  level: 1,
  experience: 0,
  reputation: 0,
} as const satisfies Partial<Prisma.PlayerUncheckedCreateInput>;

export const playerProfileSelect = {
  id: true,
  name: true,
  cash: true,
  bank: true,
  health: true,
  maxHealth: true,
  level: true,
  experience: true,
  reputation: true,
  status: true,
  statusUntil: true,
  createdAt: true,
  currentCity: { select: { id: true, slug: true, name: true } },
} as const satisfies Prisma.PlayerSelect;

export function createPlayerForUser(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
) {
  return tx.player.create({
    data: { userId, name, ...PLAYER_START_VALUES },
    select: { id: true },
  });
}

export async function getPlayerProfileByUserId(prisma: PrismaClient, userId: string) {
  const player = await prisma.player.findUnique({
    where: { userId },
    select: playerProfileSelect,
  });
  if (!player) throw notFound('PLAYER_NOT_FOUND', 'No player exists for this account');
  return serialize(player);
}
