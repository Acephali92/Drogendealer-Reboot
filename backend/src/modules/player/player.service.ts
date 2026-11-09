import type { Prisma, PrismaClient } from '@prisma/client';
import { notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { serialize } from '../../lib/serialize.js';

/**
 * Start values for newly registered players. Money in cents (ADR-019).
 * PLACEHOLDER until T-101: the start capital comes from docs/game-design/parameters.toml
 * (`start_cash_black`, `start_cash_white`) and must not be duplicated here. The data model
 * does not yet distinguish black and white money (see BACKEND_ARCHITECTURE.md, B-9).
 */
export const PLAYER_START_VALUES = {
  cash: 0n,
  bank: 0n,
  health: 100,
  maxHealth: 100,
  level: 1,
  experience: 0,
  reputation: 0,
  heat: 0,
} as const satisfies Partial<Prisma.PlayerUncheckedCreateInput>;

/** A player counts as online if they made an authenticated request within this window. */
export const ONLINE_WINDOW_MS = 5 * 60_000;

/**
 * XP needed for the next level.
 * PLACEHOLDER: returns null until the game designer defines the level curve.
 */
export function experienceForNextLevel(_level: number): number | null {
  return null;
}

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
  heat: true,
  status: true,
  statusUntil: true,
  createdAt: true,
  currentCity: { select: { id: true, slug: true, name: true } },
  clanMembership: {
    select: { role: true, clan: { select: { id: true, name: true, tag: true } } },
  },
} as const satisfies Prisma.PlayerSelect;

export function createPlayerForUser(tx: Prisma.TransactionClient, userId: string, name: string) {
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

  const { clanMembership, ...rest } = player;
  return serialize({
    ...rest,
    experienceForNextLevel: experienceForNextLevel(player.level),
    clanId: clanMembership?.clan.id ?? null,
    clan: clanMembership ? { ...clanMembership.clan, role: clanMembership.role } : null,
  });
}

export async function listMoneyTransactions(prisma: PrismaClient, playerId: string, page: Pagination) {
  const [items, total] = await prisma.$transaction([
    prisma.moneyTransaction.findMany({
      where: { playerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.offset,
      take: page.limit,
      select: { id: true, amount: true, balanceAfter: true, reason: true, refId: true, createdAt: true },
    }),
    prisma.moneyTransaction.count({ where: { playerId } }),
  ]);
  return serialize({ items, total, limit: page.limit, offset: page.offset });
}

export async function listOnlinePlayers(prisma: PrismaClient, limit = 100) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const where = { lastSeenAt: { gte: since } } satisfies Prisma.PlayerWhereInput;
  const [players, count] = await prisma.$transaction([
    prisma.player.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        level: true,
        clanMembership: { select: { clan: { select: { tag: true } } } },
      },
    }),
    prisma.player.count({ where }),
  ]);
  return {
    count,
    players: players.map(({ clanMembership, ...p }) => ({
      ...p,
      clanTag: clanMembership?.clan.tag ?? null,
    })),
  };
}
