import type { NextFunction, Request, Response } from 'express';
import type { OrderingEvent } from '@qr-menu/shared';
import { Membership, User } from '../../db/models/index.js';
import { restaurantIdOf } from '../../middleware/membership.js';
import { forbidden, notFound, unauthorized } from '../../utils/errors.js';
import { verifySseToken } from '../../utils/jwt.js';
import { orderingBus } from './events.js';

/** Keeps proxies and browsers from dropping an idle stream; also what the client watches to detect a dead one. */
export const SSE_PING_INTERVAL_MS = 25_000;

const openStreams = new Set<Response>();

/**
 * GET /api/admin/restaurants/:restaurantId/events?token=<sse token>
 * EventSource cannot set headers, so the stream authenticates with the short-lived token from POST /sse-token.
 * The membership is re-checked on connect (the token outlives a revoked membership by at most 5 minutes otherwise).
 */
export async function requireSseToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const raw = typeof req.query.token === 'string' ? req.query.token : '';
  if (!raw) throw unauthorized('Missing stream token');
  const { userId, restaurantId } = verifySseToken(raw);
  if (restaurantId !== req.params.restaurantId) throw forbidden('Stream token was issued for another restaurant');

  const user = await User.findByPk(userId, { attributes: ['id', 'email', 'name', 'isSuperadmin'] });
  if (!user) throw unauthorized('User no longer exists');
  req.user = { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin, sessionId: null };
  if (user.isSuperadmin) {
    req.membership = { restaurantId, role: 'owner', viaSuperadmin: true, elevated: true };
  } else {
    const membership = await Membership.findOne({ where: { userId, restaurantId }, attributes: ['role'] });
    if (!membership) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
    req.membership = { restaurantId, role: membership.role, viaSuperadmin: false, elevated: false };
  }
  next();
}

export function formatSseEvent(event: OrderingEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * The stream itself. Headers are flushed immediately; `no-transform` keeps Caddy's encoder from compressing (and so
 * buffering) it and `X-Accel-Buffering: no` does the same for nginx-style proxies. Nothing in the API compresses
 * responses, so there is no compression middleware to bypass. A `ping` goes out every 25 s.
 */
export function streamEvents(req: Request, res: Response): void {
  const restaurantId = restaurantIdOf(req);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('retry: 3000\n\n: connected\n\n');

  const send = (event: OrderingEvent) => {
    if (!res.writableEnded) res.write(formatSseEvent(event));
  };
  const unsubscribe = orderingBus.subscribe(restaurantId, send);
  const ping = setInterval(() => send({ type: 'ping', at: new Date().toISOString() }), SSE_PING_INTERVAL_MS);
  openStreams.add(res);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    unsubscribe();
    openStreams.delete(res);
    if (!res.writableEnded) res.end();
  };
  res.on('close', close);
  req.on('close', close);
}

/** Ends every open stream (graceful shutdown; clients reconnect to the new instance on their own). */
export function closeAllStreams(): void {
  for (const res of openStreams) {
    if (!res.writableEnded) res.end();
  }
  openStreams.clear();
}

export function openStreamCount(): number {
  return openStreams.size;
}
