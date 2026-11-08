import { execSync } from 'node:child_process';
import 'dotenv/config';

/**
 * Applies all migrations to the dedicated test database once per test run.
 * (Non-destructive; individual test files truncate the tables they use.)
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set to run the integration tests');
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL – test data gets truncated');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
