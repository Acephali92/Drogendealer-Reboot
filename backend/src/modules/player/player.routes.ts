import type { FastifyPluginAsync } from 'fastify';
import { getPlayerProfileByUserId } from './player.service.js';

const playerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const player = await getPlayerProfileByUserId(app.prisma, request.user.sub);
    return { player };
  });
};

export default playerRoutes;
