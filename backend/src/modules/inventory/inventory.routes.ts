import type { FastifyPluginAsync } from 'fastify';
import { getInventory } from './inventory.service.js';

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/inventory', async (request) => getInventory(app.prisma, app.gameParams, request.user.pid));
};

export default inventoryRoutes;
