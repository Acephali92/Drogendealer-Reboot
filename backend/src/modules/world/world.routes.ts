import type { FastifyPluginAsync } from 'fastify';
import { slugParamSchema } from '../../lib/pagination.js';
import { getCity, getCityMarket, getMarketOverview, listCities } from './world.service.js';

const worldRoutes: FastifyPluginAsync = async (app) => {
  app.get('/cities', async () => listCities(app.prisma));

  app.get('/cities/:slug', async (request) => {
    const { slug } = slugParamSchema.parse(request.params);
    return getCity(app.prisma, slug);
  });

  app.get('/cities/:slug/market', async (request) => {
    const { slug } = slugParamSchema.parse(request.params);
    return getCityMarket(app.prisma, app.gameParams, slug);
  });

  app.get('/market/overview', async () => getMarketOverview(app.prisma, app.gameParams));
};

export default worldRoutes;
