import type { NextFunction, Request, Response } from 'express';
import { uuidSchema } from '@qr-menu/shared';
import { Membership, Restaurant } from '../db/models/index.js';
import { forbidden, notFound } from '../utils/errors.js';

/**
 * Tenant guard for /api/admin/restaurants/:restaurantId/... routes.
 * The restaurant id ALWAYS comes from the route param and is checked against the
 * authenticated user's memberships; services must never read it from the body.
 * Superadmins may act on any restaurant (as an implicit owner).
 */
export function requireMembership(options: { role?: 'owner' } = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    if (!user) throw forbidden();
    const parsed = uuidSchema.safeParse(req.params.restaurantId);
    if (!parsed.success) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
    const restaurantId = parsed.data;

    if (user.isSuperadmin) {
      const exists = await Restaurant.count({ where: { id: restaurantId } });
      if (!exists) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
      req.membership = { restaurantId, role: 'owner', viaSuperadmin: true };
      next();
      return;
    }

    const membership = await Membership.findOne({
      where: { userId: user.id, restaurantId },
      attributes: ['id', 'role'],
    });
    if (!membership) throw forbidden('You are not a member of this restaurant');
    if (options.role === 'owner' && membership.role !== 'owner') throw forbidden('Owner role required');
    req.membership = { restaurantId, role: membership.role, viaSuperadmin: false };
    next();
  };
}

/** Use after requireMembership() on routes reserved for owners (settings, destructive actions). */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (req.membership?.role !== 'owner') throw forbidden('Owner role required');
  next();
}

/** The restaurant id established by requireMembership(). */
export function restaurantIdOf(req: Request): string {
  const id = req.membership?.restaurantId;
  if (!id) throw forbidden();
  return id;
}
