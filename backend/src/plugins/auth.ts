import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@prisma/client';
import { unauthorized } from '../lib/errors.js';

/** Claims carried by the short-lived access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  pid: string; // player id
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const LAST_SEEN_INTERVAL_MS = 60_000;

export interface AuthPluginOptions {
  secret: string;
  accessTokenTtl: string;
}

export default fp<AuthPluginOptions>(
  async (app, opts) => {
    await app.register(jwt, {
      secret: opts.secret,
      sign: { expiresIn: opts.accessTokenTtl },
    });

    app.decorate('authenticate', async (request: FastifyRequest) => {
      try {
        await request.jwtVerify();
      } catch {
        throw unauthorized('INVALID_ACCESS_TOKEN', 'Access token is missing, invalid or expired');
      }
      await touchLastSeen(request);
    });

    /** Records player activity for the "online" list – at most one DB write per player per interval. */
    async function touchLastSeen(request: FastifyRequest) {
      const now = new Date();
      try {
        await app.prisma.player.updateMany({
          where: {
            id: request.user.pid,
            OR: [
              { lastSeenAt: null },
              { lastSeenAt: { lt: new Date(now.getTime() - LAST_SEEN_INTERVAL_MS) } },
            ],
          },
          data: { lastSeenAt: now },
        });
      } catch (err) {
        // Presence tracking must never break a request.
        request.log.warn({ err }, 'Failed to update lastSeenAt');
      }
    }
  },
  { name: 'auth', dependencies: ['prisma'] },
);
