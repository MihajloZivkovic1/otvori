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
