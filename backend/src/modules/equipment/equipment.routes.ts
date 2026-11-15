import type { FastifyPluginAsync } from 'fastify';
import { listEquipmentTypes, listPlayerEquipment } from './equipment.service.js';

const equipmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/equipment-types', async () => listEquipmentTypes(app.prisma, app.gameParams));
  app.get('/equipment', async (request) => listPlayerEquipment(app.prisma, app.gameParams, request.user.pid));
};

export default equipmentRoutes;
