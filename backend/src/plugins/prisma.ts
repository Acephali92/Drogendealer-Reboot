import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export interface PrismaPluginOptions {
  databaseUrl: string;
}

export default fp<PrismaPluginOptions>(
  async (app, opts) => {
    const prisma = new PrismaClient({ datasources: { db: { url: opts.databaseUrl } } });
    await prisma.$connect();
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' },
);
