import { Router } from 'express';
import type { AppConfigDto, HealthDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { features } from '../../config/features.js';
import { sequelize } from '../../db/sequelize.js';

export const healthRouter = Router();

const DB_PING_TIMEOUT_MS = 2_000;

async function pingDatabase(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Database ping timed out')), DB_PING_TIMEOUT_MS);
  });
  try {
    await Promise.race([sequelize.query('SELECT 1'), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Liveness + readiness in one: `ok` is false (HTTP 503) when Postgres does not answer within 2 s. */
healthRouter.get('/', async (_req, res) => {
  const dbOk = await pingDatabase();
  const body: HealthDto = { ok: dbOk, db: dbOk ? 'ok' : 'error', version: env.APP_VERSION, features: { ...features } };
  res.setHeader('Cache-Control', 'no-store');
  res.status(dbOk ? 200 : 503).json(body);
});

/**
 * GET /api/config — what the front-ends read at startup: the build and the global feature flags. No auth, no
 * database, cacheable for a minute (a flag flip is a redeploy anyway).
 */
export const configRouter = Router();
configRouter.get('/', (_req, res) => {
  const body: AppConfigDto = { version: env.APP_VERSION, features: { ...features } };
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(body);
});
