import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch (err) {
      request.log.error({ err }, 'Health check: database unreachable');
      return reply.status(503).send({ status: 'degraded', database: 'unreachable' });
    }
  });
};

export default healthRoutes;
