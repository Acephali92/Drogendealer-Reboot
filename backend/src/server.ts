import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

let app: Awaited<ReturnType<typeof buildApp>>;
try {
  app = await buildApp(loadEnv());
} catch (err) {
  // Invalid ENV or game parameters: print the readable issue list instead of a stack trace.
  process.stderr.write(`Startup aborted: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
const env = loadEnv();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
