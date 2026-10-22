import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

function rejected(_req: Request, res: Response): void {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
}

/** Public event ingestion: generous per-IP budget, keyed by client IP. */
export const publicEventsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});

/** Credential endpoints (login, magic link, password reset). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});

/** Keyed by the guest session (requireSession runs first, so the header is present and valid). */
const sessionKey = (req: Request): string => `session:${req.sessionId ?? 'none'}`;

const tenMinutes = 10 * 60_000;

/** POST /orders: a session may place 10 orders per 10 minutes, an IP 60 (the open-orders cap applies on top). */
export const sessionOrdersLimiter = rateLimit({
  windowMs: tenMinutes,
  limit: 10,
  keyGenerator: sessionKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});
export const publicOrdersLimiter = rateLimit({
  windowMs: tenMinutes,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});

/** POST /requests (call the waiter / the bill): 8 per session and 60 per IP per 10 minutes. */
export const sessionRequestsLimiter = rateLimit({
  windowMs: tenMinutes,
  limit: 8,
  keyGenerator: sessionKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});
export const publicRequestsLimiter = rateLimit({
  windowMs: tenMinutes,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejected,
  skip: () => env.isTest,
});
