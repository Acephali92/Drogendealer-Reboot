import type { FastifyPluginAsync } from 'fastify';
import { listPlayerVehicles, listVehicleTypes } from './vehicles.service.js';

const vehicleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/vehicle-types', async () => listVehicleTypes(app.prisma, app.gameParams));
  app.get('/vehicles', async (request) => listPlayerVehicles(app.prisma, app.gameParams, request.user.pid));
};

export default vehicleRoutes;
