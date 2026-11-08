import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.schemas.js';
import { createAuthService, type ClientMeta } from './auth.service.js';

export interface AuthRoutesOptions {
  refreshTokenTtlDays: number;
  rateLimitMax: number;
}

const clientMeta = (request: FastifyRequest): ClientMeta => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, opts) => {
  const auth = createAuthService({
    prisma: app.prisma,
    signAccessToken: (payload) => app.jwt.sign(payload),
    refreshTokenTtlDays: opts.refreshTokenTtlDays,
  });

  // Brute-force protection for every auth endpoint (per client IP).
  const rateLimit = { rateLimit: { max: opts.rateLimitMax, timeWindow: '1 minute' } };

  app.post('/register', { config: rateLimit }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await auth.register(input, clientMeta(request));
    return reply.status(201).send(result);
  });

  app.post('/login', { config: rateLimit }, async (request) => {
    const input = loginSchema.parse(request.body);
    return auth.login(input, clientMeta(request));
  });

  app.post('/refresh', { config: rateLimit }, async (request) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    return auth.refresh(refreshToken, clientMeta(request));
  });

  app.post('/logout', { config: rateLimit }, async (request, reply) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    await auth.logout(refreshToken);
    return reply.status(204).send();
  });
};

export default authRoutes;
