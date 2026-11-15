import { Prisma, type PrismaClient } from '@prisma/client';
import type { Pagination } from '../../lib/pagination.js';

export const RANKING_TYPES = ['wealth', 'reputation', 'level', 'clans'] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

/** Sort expressions per player ranking. Fixed whitelist – never built from user input. */
const PLAYER_RANKING_VALUE: Record<Exclude<RankingType, 'clans'>, Prisma.Sql> = {
  wealth: Prisma.sql`(p."cash" + p."bank")`,
  reputation: Prisma.sql`p."reputation"::bigint`,
  level: Prisma.sql`p."level"::bigint`,
};

interface PlayerRankRow {
  id: string;
  name: string;
  level: number;
  clanTag: string | null;
  value: bigint;
}

interface ClanRankRow {
  id: string;
  name: string;
  tag: string;
  memberCount: bigint;
  value: bigint;
}

/**
 * Leaderboards. `value` is always a string (wealth can exceed JS number precision).
 * - wealth: cash + bank
 * - level: level, tie-break experience
 * - clans: PLACEHOLDER definition = clan treasury (cash + bank) + summed wealth of all members
 * Deleted players (ADR-017) and dissolved clans are not ranked.
 */
export async function getRanking(prisma: PrismaClient, type: RankingType, page: Pagination) {
  if (type === 'clans') {
    const [rows, total] = await Promise.all([
      prisma.$queryRaw<ClanRankRow[]>`
        SELECT c."id", c."name", c."tag",
               COUNT(m."id") AS "memberCount",
               (c."treasuryCash" + c."treasuryBank" + COALESCE(SUM(p."cash" + p."bank"), 0))::bigint AS "value"
        FROM "Clan" c
        LEFT JOIN "ClanMember" m ON m."clanId" = c."id"
        LEFT JOIN "Player" p ON p."id" = m."playerId"
        WHERE c."dissolvedAt" IS NULL
        GROUP BY c."id"
        ORDER BY "value" DESC, c."name" ASC
        LIMIT ${page.limit} OFFSET ${page.offset}`,
      prisma.clan.count({ where: { dissolvedAt: null } }),
    ]);
    return {
      type,
      total,
      limit: page.limit,
      offset: page.offset,
      entries: rows.map((r, i) => ({
        rank: page.offset + i + 1,
        clan: { id: r.id, name: r.name, tag: r.tag, memberCount: Number(r.memberCount) },
        value: r.value.toString(),
      })),
    };
  }

  const value = PLAYER_RANKING_VALUE[type];
  const tieBreak = type === 'level' ? Prisma.sql`p."experience" DESC,` : Prisma.empty;
  const [rows, total] = await Promise.all([
    prisma.$queryRaw<PlayerRankRow[]>`
      SELECT p."id", p."name", p."level", c."tag" AS "clanTag", ${value} AS "value"
      FROM "Player" p
      LEFT JOIN "ClanMember" m ON m."playerId" = p."id"
      LEFT JOIN "Clan" c ON c."id" = m."clanId"
      WHERE p."status" <> 'DELETED'
      ORDER BY "value" DESC, ${tieBreak} p."name" ASC
      LIMIT ${page.limit} OFFSET ${page.offset}`,
    prisma.player.count({ where: { status: { not: 'DELETED' } } }),
  ]);
  return {
    type,
    total,
    limit: page.limit,
    offset: page.offset,
    entries: rows.map((r, i) => ({
      rank: page.offset + i + 1,
      player: { id: r.id, name: r.name, level: r.level, clanTag: r.clanTag },
      value: r.value.toString(),
    })),
  };
}
