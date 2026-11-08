import type { Prisma, PrismaClient } from '@prisma/client';
import { notFound } from '../../lib/errors.js';
import type { Pagination } from '../../lib/pagination.js';

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const satisfies Prisma.NotificationSelect;

export async function listNotifications(
  prisma: PrismaClient,
  playerId: string,
  page: Pagination & { unreadOnly: boolean },
) {
  const where: Prisma.NotificationWhereInput = page.unreadOnly ? { playerId, readAt: null } : { playerId };
  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page.offset,
      take: page.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { playerId, readAt: null } }),
  ]);
  return { items, total, unreadCount, limit: page.limit, offset: page.offset };
}

/** Marks one of the player's own notifications as read (idempotent). */
export async function markNotificationRead(prisma: PrismaClient, playerId: string, id: string) {
  const existing = await prisma.notification.findFirst({
    where: { id, playerId },
    select: { readAt: true },
  });
  // Other players' notifications are reported as "not found" to avoid leaking their existence.
  if (!existing) throw notFound('NOTIFICATION_NOT_FOUND', 'Notification does not exist');

  const notification = existing.readAt
    ? await prisma.notification.findUniqueOrThrow({ where: { id }, select: notificationSelect })
    : await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
        select: notificationSelect,
      });
  return { notification };
}

export async function markAllNotificationsRead(prisma: PrismaClient, playerId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { playerId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: count };
}
