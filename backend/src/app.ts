import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { corsOrigins, type Env } from './config/env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import errorsPlugin from './plugins/errors.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import playerRoutes from './modules/player/player.routes.js';
import worldRoutes from './modules/world/world.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import vehicleRoutes from './modules/vehicles/vehicles.routes.js';
import equipmentRoutes from './modules/equipment/equipment.routes.js';
import travelRoutes from './modules/travel/travel.routes.js';
import clanRoutes from './modules/clans/clans.routes.js';
import rankingRoutes from './modules/rankings/rankings.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import tickerRoutes from './modules/ticker/ticker.routes.js';

export const API_PREFIX = '/api/v1';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 64 * 1024,
  });

  await app.register(errorsPlugin);
  await app.register(helmet);
  await app.register(cors, { origin: corsOrigins(env.CORS_ORIGIN), credentials: true });
  // Rate limiting is opt-in per route (see auth routes).
  await app.register(rateLimit, { global: false });
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(authPlugin, { secret: env.JWT_SECRET, accessTokenTtl: env.ACCESS_TOKEN_TTL });

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes, {
        prefix: '/auth',
        refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
        rateLimitMax: env.AUTH_RATE_LIMIT_MAX,
      });

      // Everything below requires a valid access token.
      await api.register(async (game) => {
        game.addHook('onRequest', app.authenticate);
        await game.register(playerRoutes, { prefix: '/players' });
        await game.register(worldRoutes);
        await game.register(inventoryRoutes);
        await game.register(vehicleRoutes);
        await game.register(equipmentRoutes);
        await game.register(travelRoutes);
        await game.register(clanRoutes);
        await game.register(rankingRoutes);
        await game.register(notificationRoutes);
        await game.register(tickerRoutes);
      });
    },
    { prefix: API_PREFIX },
  );

  return app;
}
