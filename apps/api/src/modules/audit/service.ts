import { Op, literal, type WhereOptions } from 'sequelize';
import {
  AUDIT_KIND_ACTIONS,
  AUDIT_LIMITS,
  isPriceChange,
  type AuditAction,
  type AuditEntryDto,
  type AuditPageDto,
  type ListAuditQuery,
} from '@qr-menu/shared';
import { AuditLog } from '../../db/models/index.js';
import { logger } from '../../utils/logger.js';
import { currentActor, type Actor } from './context.js';

export interface AuditEntry {
  restaurantId: string;
  action: AuditAction;
  entity?: { type: string; id?: string | null; label?: string | null };
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Explicit actor for places outside the membership middleware (sign-in, invites); default = the request's. */
  actor?: Partial<Actor> | null;
}

/**
 * Append one row. Never throws: a failed audit write is logged, the business action already happened.
 * Awaited by callers so tests can read the row right after the response.
 */
export async function record(entry: AuditEntry): Promise<void> {
  const base = currentActor();
  const actor: Partial<Actor> = { ...base, ...(entry.actor ?? {}) };
  try {
    await AuditLog.create({
      restaurantId: entry.restaurantId,
      userId: actor.userId ?? null,
      userName: actor.name ?? null,
      userEmail: actor.email ?? null,
      role: actor.role ?? null,
      elevated: typeof actor.elevated === 'function' ? actor.elevated() : Boolean(actor.elevated),
      action: entry.action,
      entityType: entry.entity?.type ?? null,
      entityId: entry.entity?.id ?? null,
      entityLabel: entry.entity?.label ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: actor.ip ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action, restaurantId: entry.restaurantId }, 'Audit write failed');
  }
}

/**
 * `{ before, after }` restricted to the keys whose value changed (deep-equal via JSON), so an item edit that only
 * fixed a typo does not store the whole row twice. Returns null when nothing changed.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: readonly (keyof T & string)[] = Object.keys(after) as (keyof T & string)[],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let changed = false;
  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changedBefore[key] = before[key] ?? null;
      changedAfter[key] = after[key] ?? null;
      changed = true;
    }
  }
  return changed ? { before: changedBefore, after: changedAfter } : null;
}

/** Human label for a translated name (default Serbian, then anything). */
export function labelOf(name: Record<string, string | undefined> | null | undefined): string | null {
  if (!name) return null;
  return name.sr || name.en || Object.values(name).find((v) => typeof v === 'string' && v.length > 0) || null;
}

export function toAuditEntryDto(row: AuditLog): AuditEntryDto {
  return {
    id: row.id,
    action: row.action,
    user: row.userId || row.userName ? { id: row.userId, name: row.userName ?? '', email: row.userEmail ?? '' } : null,
    role: (row.role as AuditEntryDto['role']) ?? null,
    elevated: row.elevated,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    before: row.before,
    after: row.after,
    priceChange: isPriceChange({ action: row.action, before: row.before, after: row.after }),
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}

const PRICE_ACTIONS: AuditAction[] = ['item.create', 'item.update', 'pos.sync'];

export async function listAuditLog(restaurantId: string, query: ListAuditQuery): Promise<AuditPageDto> {
  const where: WhereOptions<AuditLog> = { restaurantId };
  if (query.action) Object.assign(where, { action: query.action });
  else if (query.kind === 'prices') {
    Object.assign(where, {
      action: PRICE_ACTIONS,
      [Op.and]: [literal(`"AuditLog"."after" ?| array['priceCents','variants','priceChanges']`)],
    });
  } else if (query.kind !== 'all') Object.assign(where, { action: [...AUDIT_KIND_ACTIONS[query.kind]] });
  if (query.userId) Object.assign(where, { userId: query.userId });
  if (query.from || query.to) {
    Object.assign(where, {
      createdAt: {
        ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
        ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
      },
    });
  }
  const [{ rows, count }, users] = await Promise.all([
    AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    AuditLog.findAll({
      where: { restaurantId, userId: { [Op.ne]: null } },
      attributes: ['userId', 'userName'],
      group: ['userId', 'userName'],
      order: [['userName', 'ASC']],
    }),
  ]);
  const seen = new Map<string, string>();
  for (const u of users) if (u.userId && !seen.has(u.userId)) seen.set(u.userId, u.userName ?? '');
  return {
    items: rows.map(toAuditEntryDto),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
    users: [...seen].map(([id, name]) => ({ id, name })),
  };
}

/** Retention: delete rows older than AUDIT_LIMITS.retentionDays. */
export async function pruneAuditLog(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUDIT_LIMITS.retentionDays * 86_400_000);
  return AuditLog.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
}

/** Runs the retention every 6 hours (plus once at start). */
export function startAuditRetentionJob(): () => void {
  const run = () =>
    pruneAuditLog()
      .then((deleted) => {
        if (deleted > 0) logger.info({ deleted }, 'Audit log pruned');
      })
      .catch((err: unknown) => logger.error({ err }, 'Audit retention failed'));
  void run();
  const timer = setInterval(run, 6 * 60 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
