import 'dotenv/config';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

export async function createTestApp(overrides: Record<string, string> = {}): Promise<FastifyInstance> {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-definitely-longer-than-32-characters',
    AUTH_RATE_LIMIT_MAX: '1000',
    ...overrides,
  });
  const app = await buildApp(env);
  await app.ready();
  return app;
}

/** Removes all rows from every application table (keeps the schema and migrations table). */
export async function truncateAll(app: FastifyInstance): Promise<void> {
  const tables = await app.prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await app.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export const validUser = {
  email: 'Dealer@Example.com',
  username: 'TonyM',
  password: 'super-secret-pw',
  ageConfirmed: true,
};

export async function register(app: FastifyInstance, body: Record<string, unknown> = validUser) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: body });
}
