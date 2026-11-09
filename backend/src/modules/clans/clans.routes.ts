import type { FastifyPluginAsync } from 'fastify';
import { idParamSchema, paginationSchema } from '../../lib/pagination.js';
import { getClan, listClans, listOwnClanInvites } from './clans.service.js';

const clanRoutes: FastifyPluginAsync = async (app) => {
  app.get('/clans', async (request) => listClans(app.prisma, paginationSchema.parse(request.query)));

  app.get('/clans/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return getClan(app.prisma, id, request.user.pid);
  });

  app.get('/clan-invites', async (request) => listOwnClanInvites(app.prisma, request.user.pid));
};

export default clanRoutes;
