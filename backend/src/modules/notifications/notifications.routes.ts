import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { idParamSchema, paginationSchema } from '../../lib/pagination.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service.js';

const listQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/notifications', async (request) =>
    listNotifications(app.prisma, request.user.pid, listQuerySchema.parse(request.query)),
  );

  // Registered before '/:id/read' for readability; paths do not overlap.
  app.post('/notifications/read-all', async (request) =>
    markAllNotificationsRead(app.prisma, request.user.pid),
  );

  app.post('/notifications/:id/read', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return markNotificationRead(app.prisma, request.user.pid, id);
  });
};

export default notificationRoutes;
