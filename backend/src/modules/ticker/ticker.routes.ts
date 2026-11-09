import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const tickerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Public live ticker ("X erreicht die Stadt Y"). Events are written by the game systems later. */
const tickerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ticker', async (request) => {
    const { limit } = tickerQuerySchema.parse(request.query);
    const events = await app.prisma.tickerEvent.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: { id: true, type: true, message: true, data: true, createdAt: true },
    });
    return { events };
  });
};

export default tickerRoutes;
