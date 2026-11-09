import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';
import { getRanking, RANKING_TYPES } from './rankings.service.js';

const rankingQuerySchema = paginationSchema.extend({
  type: z.enum(RANKING_TYPES).default('wealth'),
});

const rankingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/rankings', async (request) => {
    const { type, ...page } = rankingQuerySchema.parse(request.query);
    return getRanking(app.prisma, type, page);
  });
};

export default rankingRoutes;
