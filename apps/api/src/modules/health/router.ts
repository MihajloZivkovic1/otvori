import { Router } from 'express';
import type { HealthDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
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
  const body: HealthDto = { ok: dbOk, db: dbOk ? 'ok' : 'error', version: env.APP_VERSION };
  res.setHeader('Cache-Control', 'no-store');
  res.status(dbOk ? 200 : 503).json(body);
});
