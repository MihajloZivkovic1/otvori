import 'reflect-metadata';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { sequelize } from './db/sequelize.js';
import { logger } from './utils/logger.js';

const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  await sequelize.authenticate();
  logger.info('Database connection OK');
  if (env.migrateOnStart) {
    await runMigrations();
    logger.info('Migrations are up to date');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ version: env.APP_VERSION }, `API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  // Longer than the reverse proxy's idle timeout, so a keep-alive socket is never closed underneath Caddy.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down: finishing in-flight requests');
    server.close((error) => {
      if (error) logger.warn({ err: error }, 'HTTP server did not close cleanly');
      sequelize
        .close()
        .catch((dbError: unknown) => logger.warn({ err: dbError }, 'Database pool did not close cleanly'))
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
    setTimeout(() => {
      logger.error(`Forcing exit after ${SHUTDOWN_GRACE_MS / 1000} s`);
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason: unknown) => logger.error({ err: reason }, 'Unhandled promise rejection'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start API');
  process.exit(1);
});
