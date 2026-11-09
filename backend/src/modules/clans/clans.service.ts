import type { ClanRole, PrismaClient } from '@prisma/client';
import { notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';
import { serialize } from '../../lib/serialize.js';

/** Hierarchy from top to bottom (Pate, Consigliere, Capo, Soldat, Mitläufer). */
export const CLAN_ROLE_ORDER: readonly ClanRole[] = [
  'GODFATHER',
  'CONSIGLIERE',
  'CAPO',
  'SOLDIER',
  'ASSOCIATE',
];

export async function listClans(prisma: PrismaClient, page: Pagination) {
  const [clans, total] = await prisma.$transaction([
    prisma.clan.findMany({
      orderBy: { name: 'asc' },
      skip: page.offset,
      take: page.limit,
      select: {
        id: true,
        name: true,
        tag: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    }),
    prisma.clan.count(),
  ]);
  return {
    clans: clans.map(({ _count, ...c }) => ({ ...c, memberCount: _count.members })),
    total,
    limit: page.limit,
    offset: page.offset,
  };
}

/** Clan details. The clan bank is only visible to members. */
export async function getClan(prisma: PrismaClient, clanId: string, viewerPlayerId: string) {
  const clan = await prisma.clan.findUnique({
    where: { id: clanId },
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      bank: true,
      createdAt: true,
      members: {
        select: {
          role: true,
          joinedAt: true,
          player: { select: { id: true, name: true, level: true, reputation: true } },
        },
      },
    },
  });
  if (!clan) throw notFound('CLAN_NOT_FOUND', 'Clan does not exist');

  const isMember = clan.members.some((m) => m.player.id === viewerPlayerId);
  const members = clan.members
    .map(({ player, role, joinedAt }) => ({
      playerId: player.id,
      name: player.name,
      level: player.level,
      reputation: player.reputation,
      role,
      joinedAt,
    }))
    .sort(
      (a, b) =>
        CLAN_ROLE_ORDER.indexOf(a.role) - CLAN_ROLE_ORDER.indexOf(b.role) ||
        a.joinedAt.getTime() - b.joinedAt.getTime(),
    );

  return serialize({
    clan: {
      ...clan,
      bank: isMember ? clan.bank : null,
      memberCount: members.length,
      members,
    },
  });
}

export async function listOwnClanInvites(prisma: PrismaClient, playerId: string) {
  const invites = await prisma.clanInvite.findMany({
    where: { playerId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      clan: { select: { id: true, name: true, tag: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });
  return { invites };
}
