import { Router } from 'express';
import type { HealthDto } from '@qr-menu/shared';
import { sequelize } from '../../db/sequelize.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let db: HealthDto['db'] = 'ok';
  try {
    await sequelize.authenticate();
  } catch {
    db = 'error';
  }
  const body: HealthDto = {
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? '0.0.0',
  };
  res.setHeader('Cache-Control', 'no-store');
  res.status(db === 'ok' ? 200 : 503).json(body);
});
