import type { NextFunction, Request, Response } from 'express';
import { User } from '../db/models/index.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Requires `Authorization: Bearer <accessToken>`; populates `req.user`. Deactivated accounts are refused outright.
 * An "Open as owner" token (Phase 13) is accepted only while its subject is still a superadmin; for its duration
 * `req.user.isSuperadmin` is false and `req.user.impersonation` names the one venue it may touch.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Missing bearer token');
  const { userId, sessionId, impersonatedRestaurantId } = verifyAccessToken(token.trim());
  const user = await User.findByPk(userId, { attributes: ['id', 'email', 'name', 'isSuperadmin', 'deactivatedAt'] });
  if (!user) throw unauthorized('User no longer exists');
  if (user.deactivatedAt) throw unauthorized('This account has been deactivated', 'ACCOUNT_DEACTIVATED');
  if (impersonatedRestaurantId) {
    if (!user.isSuperadmin) throw unauthorized('Invalid access token');
    req.user = { id: user.id, email: user.email, name: user.name, isSuperadmin: false, sessionId, impersonation: { restaurantId: impersonatedRestaurantId } };
  } else {
    req.user = { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin, sessionId };
  }
  next();
}

export function requireSuperadmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isSuperadmin) throw forbidden('Superadmin access required');
  next();
}
