import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { deleteAccount, exportAccountData } from './account.service.js';

const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

/** Account self-service (ADR-015 / T-306). Registered under /players inside the authenticated scope. */
export interface AccountRoutesOptions {
  rateLimitMax: number;
}

const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (app, opts) => {
  const rateLimit = { rateLimit: { max: opts.rateLimitMax, timeWindow: '1 minute' } };

  app.get('/me/export', { config: rateLimit }, async (request, reply) => {
    const data = await exportAccountData(app.prisma, request.user.sub);
    const date = new Date().toISOString().slice(0, 10);
    return reply
      .header('content-disposition', `attachment; filename="drogendealer-export-${date}.json"`)
      .header('cache-control', 'no-store')
      .send(data);
  });

  app.delete('/me', { config: rateLimit }, async (request, reply) => {
    const { password } = deleteAccountSchema.parse(request.body);
    await deleteAccount(app.prisma, request.user.sub, password);
    return reply.status(204).send();
  });
};

export default accountRoutes;
