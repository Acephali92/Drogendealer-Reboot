import type { FastifyPluginAsync } from 'fastify';
import { listEquipmentTypes, listPlayerEquipment } from './equipment.service.js';

const equipmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/equipment-types', async () => listEquipmentTypes(app.prisma));
  app.get('/equipment', async (request) => listPlayerEquipment(app.prisma, request.user.pid));
};

export default equipmentRoutes;
