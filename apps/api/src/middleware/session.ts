import type { NextFunction, Request, Response } from 'express';
import { uuidSchema } from '@qr-menu/shared';
import { AppError } from '../utils/errors.js';

/**
 * Public ordering endpoints identify the guest by the `X-Session-Id` header: the per-tab uuid the menu app already
 * keeps for analytics. It scopes order reads/cancels and the per-session limits; it is never trusted for anything else.
 */
export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  const parsed = uuidSchema.safeParse(req.get('x-session-id'));
  if (!parsed.success) throw new AppError(400, 'SESSION_REQUIRED', 'The X-Session-Id header must be a UUID');
  req.sessionId = parsed.data;
  next();
}
