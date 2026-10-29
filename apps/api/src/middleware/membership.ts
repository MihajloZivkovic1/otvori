import type { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import { uuidSchema } from '@qr-menu/shared';
import { Membership, Restaurant } from '../db/models/index.js';
import { runWithActor } from '../modules/audit/context.js';
import { AppError, forbidden, notFound } from '../utils/errors.js';
import { verifyElevationToken } from '../utils/jwt.js';

export const ELEVATION_HEADER = 'x-elevation';

/** 403 for a staff member on an owner route (Phase 11 matrix: docs/PERMISSIONS.md). */
export const roleRequired = () => new AppError(403, 'ROLE_REQUIRED', 'Only the owner can do this', { role: 'owner' });

/** 403 for an owner whose venue has a PIN and whose request carries no valid elevation token. */
export const pinRequired = () =>
  new AppError(403, 'PIN_REQUIRED', 'Enter the owner PIN to unlock this action on this device', { pinSet: true });

/**
 * Tenant guard for /api/admin/restaurants/:restaurantId/... routes.
 * The restaurant id ALWAYS comes from the route param and is checked against the
 * authenticated user's memberships; services must never read it from the body.
 * Superadmins may act on any restaurant (as an implicit owner).
 * Also opens the audit context (who / role / ip) for everything downstream (modules/audit/context.ts).
 */
export function requireMembership(options: { role?: 'owner' } = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    if (!user) throw forbidden();
    const parsed = uuidSchema.safeParse(req.params.restaurantId);
    if (!parsed.success) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
    const restaurantId = parsed.data;

    // "Open as owner" (Phase 13): the token is scoped to one venue and acts as its owner without a PIN.
    if (user.impersonation) {
      if (user.impersonation.restaurantId !== restaurantId) {
        throw new AppError(403, 'IMPERSONATION_SCOPE', 'This session is limited to one venue', { restaurantId: user.impersonation.restaurantId });
      }
      const exists = await Restaurant.count({ where: { id: restaurantId } });
      if (!exists) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
      req.membership = { restaurantId, role: 'owner', viaSuperadmin: true, elevated: true };
      runWithActor(actorOf(req), next);
      return;
    }

    if (user.isSuperadmin) {
      const exists = await Restaurant.count({ where: { id: restaurantId } });
      if (!exists) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
      req.membership = { restaurantId, role: 'owner', viaSuperadmin: true, elevated: true };
      runWithActor(actorOf(req), next);
      return;
    }

    const membership = await Membership.findOne({
      where: { userId: user.id, restaurantId },
      attributes: ['id', 'role'],
    });
    if (!membership) throw forbidden('You are not a member of this restaurant');
    if (options.role === 'owner' && membership.role !== 'owner') throw roleRequired();
    req.membership = { restaurantId, role: membership.role, viaSuperadmin: false, elevated: false };
    runWithActor(actorOf(req), next);
  };
}

function actorOf(req: Request) {
  const user = req.user!;
  const membership = req.membership!;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: membership.viaSuperadmin ? ('superadmin' as const) : membership.role,
    elevated: () => Boolean(req.membership?.elevated),
    ip: req.ip ?? null,
  };
}

/**
 * The one guard for owner-level actions (docs/PERMISSIONS.md). Staff → 403 ROLE_REQUIRED. When the venue has an
 * owner PIN, the request must also carry a valid `X-Elevation` token bound to this sign-in → otherwise 403
 * PIN_REQUIRED, so the keypad in the UI can never be bypassed from devtools. Superadmins (support) skip the PIN.
 */
export async function requireOwner(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const membership = req.membership;
  if (!membership) throw forbidden();
  if (membership.role !== 'owner') throw roleRequired();
  if (membership.viaSuperadmin) {
    next();
    return;
  }
  const pinSet = await Restaurant.count({ where: { id: membership.restaurantId, ownerPinHash: { [Op.ne]: null } } });
  if (pinSet) {
    const claims = verifyElevationToken(headerValue(req, ELEVATION_HEADER));
    const user = req.user!;
    const valid =
      claims &&
      claims.userId === user.id &&
      claims.restaurantId === membership.restaurantId &&
      user.sessionId !== null &&
      claims.sessionId === user.sessionId;
    if (!valid) throw pinRequired();
  }
  membership.elevated = true;
  next();
}

/**
 * Owner role without the PIN gate: for the security routes that create elevation (unlock, extend) or prove the owner
 * with the password (set / remove the PIN). Everything else owner-level goes through requireOwner.
 */
export function requireOwnerRole(req: Request, _res: Response, next: NextFunction): void {
  const membership = req.membership;
  if (!membership) throw forbidden();
  if (membership.role !== 'owner') throw roleRequired();
  next();
}

export function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** The restaurant id established by requireMembership(). */
export function restaurantIdOf(req: Request): string {
  const id = req.membership?.restaurantId;
  if (!id) throw forbidden();
  return id;
}
