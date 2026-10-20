import type { Response } from 'express';
import { uuidSchema } from '@qr-menu/shared';
import { badRequest } from './errors.js';

/** Validate a route param as a UUID; a malformed id is a 400 rather than a Postgres cast error. */
export function uuidParam(value: unknown, name = 'id'): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw badRequest('Request validation failed', [{ path: name, message: `${name} must be a UUID`, code: 'invalid_format' }]);
  }
  return result.data;
}

export function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}
