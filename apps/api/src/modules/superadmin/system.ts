import { Op } from 'sequelize';
import type { OrderDto, SystemStatusDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { features } from '../../config/features.js';
import { MenuItem, Order, Payment, PosJob, Restaurant, RestaurantTable, ScanEvent, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { notFound } from '../../utils/errors.js';
import { startOfDayInZone } from '../../utils/time.js';
import * as audit from '../audit/service.js';
import { retryPosJobs } from '../pos/service.js';

const DAY_MS = 86_400_000;
const STARTED_AT = new Date(Date.now() - process.uptime() * 1000);
const PLATFORM_TZ = 'Europe/Belgrade';

async function pingDatabase(): Promise<boolean> {
  try {
    await Promise.race([sequelize.query('SELECT 1'), new Promise((_r, reject) => setTimeout(() => reject(new Error('timeout')), 2_000))]);
    return true;
  } catch {
    return false;
  }
}

/** GET /api/superadmin/system — one screen with everything an operator checks first. */
export async function systemStatus(now = new Date()): Promise<SystemStatusDto> {
  const today = startOfDayInZone(now, PLATFORM_TZ);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [
    db,
    restaurants,
    active,
    trial,
    suspended,
    published,
    onboarding,
    users,
    tables,
    items,
    scansToday,
    scansLast7Days,
    ordersToday,
    ordersLast7Days,
    posQueued,
    posRunning,
    posFailed,
    posDone,
    paymentsPending,
    paymentsPaid,
    failedJobs,
  ] = await Promise.all([
    pingDatabase(),
    Restaurant.count(),
    Restaurant.count({ where: { status: 'active' } }),
    Restaurant.count({ where: { status: 'trial' } }),
    Restaurant.count({ where: { status: 'suspended' } }),
    Restaurant.count({ where: { publishedAt: { [Op.ne]: null } } }),
    Restaurant.count({ where: { onboardingStep: { [Op.ne]: null } } }),
    User.count(),
    RestaurantTable.count(),
    MenuItem.count(),
    ScanEvent.count({ where: { scannedAt: { [Op.gte]: today } } }),
    ScanEvent.count({ where: { scannedAt: { [Op.gte]: weekAgo } } }),
    Order.count({ where: { createdAt: { [Op.gte]: today } } }),
    Order.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
    PosJob.count({ where: { status: 'queued' } }),
    PosJob.count({ where: { status: 'running' } }),
    PosJob.count({ where: { status: 'failed' } }),
    PosJob.count({ where: { status: 'done', updatedAt: { [Op.gte]: dayAgo } } }),
    Payment.count({ where: { status: 'pending' } }),
    Payment.count({ where: { status: 'paid', paidAt: { [Op.gte]: dayAgo } } }),
    PosJob.findAll({
      where: { status: 'failed' },
      include: [
        { model: Restaurant, attributes: ['id', 'name'] },
        { model: Order, attributes: ['id', 'number'] },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 50,
    }),
  ]);
  return {
    version: env.APP_VERSION,
    nodeEnv: env.NODE_ENV,
    startedAt: STARTED_AT.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    db: db ? 'ok' : 'error',
    features: { ...features },
    mail: { provider: env.MAIL_PROVIDER, from: env.MAIL_FROM },
    storage: { driver: env.s3 ? 's3' : 'local', bucket: env.s3?.bucket ?? null },
    mocks: { payments: env.PAYMENTS_MOCK, pos: env.POS_MOCK },
    counts: { restaurants, active, trial, suspended, published, onboarding, users, tables, items, scansToday, scansLast7Days, ordersToday, ordersLast7Days },
    queues: {
      pos: { queued: posQueued, running: posRunning, failed: posFailed, doneLast24h: posDone },
      payments: { pending: paymentsPending, paidLast24h: paymentsPaid },
    },
    failedJobs: failedJobs.map((job) => ({
      id: job.id,
      restaurant: { id: job.restaurant?.id ?? job.restaurantId, name: job.restaurant?.name ?? '' },
      orderId: job.orderId,
      orderNumber: job.order?.number ?? null,
      type: job.type,
      attempts: job.attempts,
      lastError: job.lastError ?? null,
      updatedAt: job.updatedAt.toISOString(),
    })),
  };
}

/** POST /api/superadmin/system/pos-jobs/:id/retry — the same retry the waiter card offers, from the System page. */
export async function retryFailedJob(jobId: string): Promise<OrderDto> {
  const job = await PosJob.findByPk(jobId);
  if (!job) throw notFound('Job not found');
  const order = await retryPosJobs(job.restaurantId, job.orderId);
  await audit.record({ restaurantId: job.restaurantId, action: 'admin.pos_job_retry', entity: { type: 'order', id: order.id, label: `#${order.number}` }, after: { jobId, type: job.type } });
  return order;
}
