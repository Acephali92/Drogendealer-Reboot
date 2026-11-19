import type { Prisma, PrismaClient } from '@prisma/client';
import type { GameParameters } from '../../domain/index.js';
import { notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { serialize } from '../../lib/serialize.js';
import { citySummaryView } from '../catalog/catalog.js';
import { bookMoney } from '../money/ledger.js';

/** A player counts as online if they made an authenticated request within this window. */
export const ONLINE_WINDOW_MS = 5 * 60_000;

/**
 * XP needed for the next level.
 * PLACEHOLDER: returns null until the progression rules (Agent 5) are implemented.
 */
export function experienceForNextLevel(_level: number): number | null {
  return null;
}

/**
 * Creates the player of a new account with values from parameters.toml [player] and books the
 * start capital in the money journal (START_CAPITAL), so that projection = Σ journal from the
 * first moment on (ADR-010, ADR-023: cash = black money, bank = laundered money).
 */
export async function createPlayerForUser(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
  params: GameParameters,
) {
  const player = await tx.player.create({
    data: { userId, name, health: params.player.hp_max, maxHealth: params.player.hp_max },
    select: { id: true },
  });
  await bookMoney(tx, {
    playerId: player.id,
    account: 'CASH',
    amount: params.player.start_cash_black,
    reason: 'START_CAPITAL',
  });
  await bookMoney(tx, {
    playerId: player.id,
    account: 'BANK',
    amount: params.player.start_cash_white,
    reason: 'START_CAPITAL',
  });
  return player;
}

export async function getPlayerProfileByUserId(prisma: PrismaClient, params: GameParameters, userId: string) {
  const player = await prisma.player.findUnique({
    where: { userId },
    select: {
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
      currentCityId: true,
      currentCity: { select: { id: true, slug: true } },
      heat: { select: { cityId: true, heat: true } },
      clanMembership: {
        select: { role: true, clan: { select: { id: true, name: true, tag: true } } },
      },
    },
  });
  if (!player) throw notFound('PLAYER_NOT_FOUND', 'No player exists for this account');

  const { clanMembership, heat, currentCity, currentCityId, ...rest } = player;
  return serialize({
    ...rest,
    /** Heat in the current city (trade.md §2: heat is per player and city). */
    heat: heat.find((h) => h.cityId === currentCityId)?.heat ?? 0,
    currentCity: currentCity ? citySummaryView(params, currentCity) : null,
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
      select: {
        id: true,
        account: true,
        amount: true,
        balanceAfter: true,
        reason: true,
        refId: true,
        createdAt: true,
      },
    }),
    prisma.moneyTransaction.count({ where: { playerId } }),
  ]);
  return serialize({ items, total, limit: page.limit, offset: page.offset });
}

export async function listOnlinePlayers(prisma: PrismaClient, limit = 100) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const where = {
    lastSeenAt: { gte: since },
    status: { not: 'DELETED' },
  } satisfies Prisma.PlayerWhereInput;
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
