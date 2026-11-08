import type { FastifyPluginAsync } from 'fastify';
import { paginationSchema } from '../../lib/pagination.js';
import { getPlayerProfileByUserId, listMoneyTransactions, listOnlinePlayers } from './player.service.js';

/** Registered inside the authenticated scope (see app.ts). */
const playerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request) => {
    const player = await getPlayerProfileByUserId(app.prisma, request.user.sub);
    return { player };
  });

  app.get('/me/transactions', async (request) => {
    const page = paginationSchema.parse(request.query);
    return listMoneyTransactions(app.prisma, request.user.pid, page);
  });

  app.get('/online', async () => listOnlinePlayers(app.prisma));
};

export default playerRoutes;
