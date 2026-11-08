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
    });
  },
  { name: 'auth' },
);
