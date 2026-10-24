import { Op } from 'sequelize';
import {
  DEFAULT_ELEVATION_WINDOW,
  PIN_LIMITS,
  type ElevationDto,
  type ElevationWindow,
  type RemovePinInput,
  type SecurityDto,
  type SetPinInput,
  type UnlockInput,
  type UpdateSecurityInput,
} from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { AuditLog, Membership, Restaurant, User } from '../../db/models/index.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, notFound, unauthorized } from '../../utils/errors.js';
import { signElevationToken, verifyElevationToken } from '../../utils/jwt.js';
import { logger } from '../../utils/logger.js';
import { sendPinLockoutAlert } from '../../utils/mailer.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import * as audit from '../audit/service.js';
import { lockedUntil, registerFailure, registerSuccess } from './lockout.js';

const hashPin = hashPassword;
const verifyPin = verifyPassword;

async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'name', 'ownerPinHash', 'timezone'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

async function assertPassword(userId: string, password: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw unauthorized('User no longer exists');
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong password');
  }
  return user;
}

export async function getSecurity(restaurantId: string, user: AuthUser): Promise<SecurityDto> {
  const [restaurant, membership] = await Promise.all([
    loadRestaurant(restaurantId),
    Membership.findOne({ where: { restaurantId, userId: user.id }, attributes: ['dailyDigest'] }),
  ]);
  return {
    pinSet: restaurant.ownerPinHash !== null,
    dailyDigest: membership?.dailyDigest ?? false,
    lockedUntil: lockedUntil(restaurantId, user.sessionId)?.toISOString() ?? null,
  };
}

export async function updateSecurity(restaurantId: string, user: AuthUser, input: UpdateSecurityInput): Promise<SecurityDto> {
  if (input.dailyDigest !== undefined) {
    const membership = await Membership.findOne({ where: { restaurantId, userId: user.id } });
    if (membership && membership.dailyDigest !== input.dailyDigest) {
      await membership.update({ dailyDigest: input.dailyDigest });
      await audit.record({ restaurantId, action: 'team.digest', after: { dailyDigest: input.dailyDigest } });
    }
  }
  return getSecurity(restaurantId, user);
}

/** Set or change the PIN; the password confirms the owner is at the keyboard (no elevation needed). */
export async function setPin(restaurantId: string, user: AuthUser, input: SetPinInput): Promise<SecurityDto> {
  await assertPassword(user.id, input.password);
  const restaurant = await loadRestaurant(restaurantId);
  const had = restaurant.ownerPinHash !== null;
  await restaurant.update({ ownerPinHash: await hashPin(input.pin) });
  await audit.record({ restaurantId, action: had ? 'auth.pin_change' : 'auth.pin_set' });
  return getSecurity(restaurantId, user);
}

export async function removePin(restaurantId: string, user: AuthUser, input: RemovePinInput): Promise<SecurityDto> {
  await assertPassword(user.id, input.password);
  const restaurant = await loadRestaurant(restaurantId);
  if (restaurant.ownerPinHash !== null) {
    await restaurant.update({ ownerPinHash: null });
    await audit.record({ restaurantId, action: 'auth.pin_remove' });
  }
  return getSecurity(restaurantId, user);
}

function issue(user: AuthUser, restaurantId: string, window: ElevationWindow): ElevationDto {
  if (!user.sessionId) throw unauthorized('Sign in again to unlock owner actions');
  const { token, expiresAt } = signElevationToken({ userId: user.id, restaurantId, sessionId: user.sessionId, window });
  return { restaurantId, token, expiresAt: expiresAt.toISOString(), window };
}

/**
 * The keypad: a correct PIN (or the owner's password) → an elevation token for the chosen window. Wrong attempts
 * count per sign-in and per venue; the 5th locks both for 15 minutes, every lockout is logged, and the owners get
 * an e-mail once a venue has had two lockouts within 24 hours.
 */
export async function unlock(restaurantId: string, user: AuthUser, input: UnlockInput): Promise<ElevationDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const locked = lockedUntil(restaurantId, user.sessionId);
  if (locked) throw pinLocked(locked);

  let ok: boolean;
  if (input.password !== undefined) {
    const account = await User.findByPk(user.id);
    ok = Boolean(account && (await verifyPassword(input.password, account.passwordHash)));
  } else {
    if (restaurant.ownerPinHash === null) throw new AppError(409, 'PIN_NOT_SET', 'This venue has no owner PIN');
    ok = await verifyPin(input.pin ?? '', restaurant.ownerPinHash);
  }

  if (!ok) {
    const outcome = registerFailure(restaurantId, user.sessionId);
    await audit.record({ restaurantId, action: 'auth.pin_failed', after: { method: input.password !== undefined ? 'password' : 'pin' } });
    if (outcome.lockedUntil) {
      await audit.record({ restaurantId, action: 'auth.pin_lockout', after: { until: outcome.lockedUntil.toISOString() } });
      await maybeAlertOwners(restaurant);
      throw pinLocked(outcome.lockedUntil);
    }
    throw new AppError(401, 'PIN_INVALID', 'Wrong PIN', { attemptsLeft: outcome.attemptsLeft });
  }

  registerSuccess(restaurantId, user.sessionId);
  const elevation = issue(user, restaurantId, input.window);
  await audit.record({
    restaurantId,
    action: 'auth.pin_unlock',
    after: { window: input.window, method: input.password !== undefined ? 'password' : 'pin' },
    actor: { elevated: () => true },
  });
  return elevation;
}

/** `session` tokens are renewed for as long as the app is open: same sign-in, same venue, still valid. */
export function extend(restaurantId: string, user: AuthUser, token: string | undefined): ElevationDto {
  const claims = verifyElevationToken(token);
  if (
    !claims ||
    claims.userId !== user.id ||
    claims.restaurantId !== restaurantId ||
    claims.sessionId !== user.sessionId ||
    claims.window !== 'session'
  ) {
    throw new AppError(403, 'PIN_REQUIRED', 'Enter the owner PIN again', { pinSet: true });
  }
  return issue(user, restaurantId, 'session');
}

/** After a password sign-in: every owned venue with a PIN starts unlocked for the default window on that device. */
export async function elevationsAfterPasswordLogin(user: AuthUser): Promise<ElevationDto[]> {
  if (!user.sessionId) return [];
  const memberships = await Membership.findAll({
    where: { userId: user.id, role: 'owner' },
    include: [{ model: Restaurant, required: true, attributes: ['id', 'ownerPinHash'], where: { ownerPinHash: { [Op.ne]: null } } }],
  });
  return memberships.map((m) => issue(user, m.restaurantId, DEFAULT_ELEVATION_WINDOW));
}

function pinLocked(until: Date): AppError {
  return new AppError(423, 'PIN_LOCKED', `Too many wrong PINs — try again at ${until.toISOString()}`, { lockedUntil: until.toISOString() });
}

/** Second lockout within 24 hours → mail every owner of the venue (once per lockout, not per attempt). */
async function maybeAlertOwners(restaurant: Restaurant): Promise<void> {
  const since = new Date(Date.now() - 86_400_000);
  const lockouts = await AuditLog.count({ where: { restaurantId: restaurant.id, action: 'auth.pin_lockout', createdAt: { [Op.gte]: since } } });
  if (lockouts < PIN_LIMITS.lockoutsBeforeEmail) return;
  const owners = await Membership.findAll({
    where: { restaurantId: restaurant.id, role: 'owner' },
    include: [{ model: User, attributes: ['email', 'name'] }],
  });
  const historyUrl = `${env.APP_URL}/r/${restaurant.id}/settings/history`;
  await Promise.all(
    owners
      .filter((m) => m.user && !m.user.email.endsWith('.staff.otvori.menu'))
      .map((m) => sendPinLockoutAlert(m.user!.email, { venue: restaurant.name, lockouts, historyUrl }).catch((err: unknown) => logger.error({ err }, 'Lockout alert failed'))),
  );
}
