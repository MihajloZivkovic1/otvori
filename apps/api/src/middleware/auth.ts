import type { NextFunction, Request, Response } from 'express';
import { User } from '../db/models/index.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';

/** Requires `Authorization: Bearer <accessToken>`; populates `req.user`. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Missing bearer token');
  const { userId } = verifyAccessToken(token.trim());
  const user = await User.findByPk(userId, { attributes: ['id', 'email', 'name', 'isSuperadmin'] });
  if (!user) throw unauthorized('User no longer exists');
  req.user = { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin };
  next();
}

export function requireSuperadmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isSuperadmin) throw forbidden('Superadmin access required');
  next();
}
