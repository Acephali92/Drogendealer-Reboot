import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Uniform error format for every response: { error: { code, message, details? } }. */
export default fp(
  async (app) => {
    app.setErrorHandler((err, request, reply) => {
      if (err instanceof AppError) {
        return reply
          .status(err.statusCode)
          .send({ error: { code: err.code, message: err.message } } satisfies ErrorBody);
      }

      if (err instanceof ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        } satisfies ErrorBody);
      }

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply
          .status(409)
          .send({ error: { code: 'CONFLICT', message: 'Resource already exists' } } satisfies ErrorBody);
      }

      const fastifyErr = err as { statusCode?: number; code?: string; message?: string };
      const status = fastifyErr.statusCode ?? 500;
      if (status >= 400 && status < 500) {
        return reply.status(status).send({
          error: {
            code: status === 429 ? 'RATE_LIMITED' : (fastifyErr.code ?? 'BAD_REQUEST'),
            message: fastifyErr.message ?? 'Bad request',
          },
        } satisfies ErrorBody);
      }

      request.log.error({ err }, 'Unhandled error');
      return reply
        .status(500)
        .send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } } satisfies ErrorBody);
    });

    app.setNotFoundHandler((request, reply) => {
      reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
      } satisfies ErrorBody);
    });
  },
  { name: 'errors' },
);
