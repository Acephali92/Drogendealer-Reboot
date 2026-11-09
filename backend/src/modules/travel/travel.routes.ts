import type { FastifyPluginAsync } from 'fastify';
import { getCurrentTravel } from './travel.service.js';

const travelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/travel/current', async (request) => getCurrentTravel(app.prisma, request.user.pid));
};

export default travelRoutes;
