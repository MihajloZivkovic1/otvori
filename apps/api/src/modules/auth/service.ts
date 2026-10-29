import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import {
  type AcceptInviteInput,
  type ElevationDto,
  type JoinWithCodeInput,
  type LoginInput,
  type MembershipDto,
  type RegisterInput,
  type RestaurantSummaryDto,
  type UserDto,
} from '@qr-menu/shared';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AuthToken, Membership, Restaurant, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { conflict, unauthorized } from '../../utils/errors.js';
import { signAccessToken } from '../../utils/jwt.js';
import { sendMagicLink, sendPasswordReset } from '../../utils/mailer.js';
import { toIso } from '../../utils/objects.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/tokens.js';
import * as audit from '../audit/service.js';
import { createRestaurantWithOwner } from '../restaurants/service.js';
import { elevationsAfterPasswordLogin } from '../security/service.js';
import * as team from '../team/service.js';

const MAGIC_LINK_TTL_MS = 15 * 60_000;
const PASSWORD_RESET_TTL_MS = 60 * 60_000;
const DAY_MS = 86_400_000;

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserDto;
  memberships: MembershipDto[];
  /** Only after a password sign-in: owned venues with a PIN start unlocked for the default window (Phase 11). */
  elevations?: ElevationDto[];
}

export type LoginMethod = 'password' | 'magic_link' | 'invite' | 'join_code' | 'password_reset';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperadmin: user.isSuperadmin,
    hasPassword: Boolean(user.passwordHash),
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Where a sign-in came from (kept on the refresh token for the account's sessions list). */
export interface SessionMeta {
  ip: string | null;
  userAgent: string | null;
}

export function toRestaurantSummaryDto(restaurant: Restaurant): RestaurantSummaryDto {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: restaurant.city,
    logoUrl: restaurant.logoUrl,
    primaryColor: restaurant.primaryColor,
    status: restaurant.status,
    plan: restaurant.plan,
    publishedAt: toIso(restaurant.publishedAt),
  };
}

export async function listMemberships(userId: string): Promise<MembershipDto[]> {
  const memberships = await Membership.findAll({
    where: { userId },
    include: [{ model: Restaurant, required: true }],
  });
  return memberships
    .filter((m) => m.restaurant)
    .sort((a, b) => a.restaurant!.name.localeCompare(b.restaurant!.name))
    .map((m) => ({ id: m.id, role: m.role, restaurant: toRestaurantSummaryDto(m.restaurant!) }));
}

/**
 * Issue an access token + a fresh refresh token (persisted as a hash). `sessionId` identifies the sign-in across
 * rotations (a refresh passes the old one on); it rides in the access token as `sid` and binds elevation tokens.
 */
export async function createSession(user: User, sessionId: string = randomUUID(), meta: SessionMeta = { ip: null, userAgent: null }): Promise<Session> {
  if (user.deactivatedAt) throw unauthorized('This account has been deactivated', 'ACCOUNT_DEACTIVATED');
  const { token, expiresIn } = signAccessToken(user.id, sessionId);
  const refreshToken = generateOpaqueToken(48);
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * DAY_MS);
  await AuthToken.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    type: 'refresh',
    expiresAt: refreshExpiresAt,
    sessionId,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return {
    accessToken: token,
    expiresIn,
    refreshToken,
    refreshExpiresAt,
    user: toUserDto(user),
    memberships: await listMemberships(user.id),
  };
}

/** A new sign-in: the session, the audit rows ("auth.login" per venue) and, after a password, the elevations. */
async function openSession(user: User, method: LoginMethod, ip: string | null, restaurantIds?: string[], userAgent: string | null = null): Promise<Session> {
  const session = await createSession(user, undefined, { ip, userAgent });
  await user.update({ lastLoginAt: new Date() });
  const venues = restaurantIds ?? session.memberships.map((m) => m.restaurant.id);
  const roleOf = (restaurantId: string) => session.memberships.find((m) => m.restaurant.id === restaurantId)?.role ?? null;
  await Promise.all(
    venues.map((restaurantId) =>
      audit.record({
        restaurantId,
        action: 'auth.login',
        after: { method },
        actor: { userId: user.id, name: user.name, email: user.email, role: roleOf(restaurantId), elevated: () => false, ip },
      }),
    ),
  );
  if (method === 'password' || method === 'password_reset') {
    const authUser = { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin, sessionId: sessionIdOf(session) };
    const elevations = await elevationsAfterPasswordLogin(authUser);
    if (elevations.length > 0) session.elevations = elevations;
  }
  return session;
}

function sessionIdOf(session: Session): string | null {
  // The session id is inside the access token; decode without verifying (we just signed it).
  const payload = JSON.parse(Buffer.from(session.accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sid?: string };
  return payload.sid ?? null;
}

export async function register(input: RegisterInput): Promise<Session> {
  const existing = await User.findOne({ where: { email: input.email }, attributes: ['id'] });
  if (existing) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({ email: input.email, name: input.name, passwordHash }, { transaction });
    await createRestaurantWithOwner(created.id, input.restaurantName, transaction);
    return created;
  });
  return createSession(user);
}

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('dummy-password-for-timing');
  return dummyHashPromise;
}

export async function login(input: LoginInput, ip: string | null = null, userAgent: string | null = null): Promise<Session> {
  const user = await User.findOne({ where: { email: input.email } });
  // Always run a bcrypt comparison so unknown emails take the same time as wrong passwords.
  const valid = user?.passwordHash
    ? await verifyPassword(input.password, user.passwordHash)
    : (await bcrypt.compare(input.password, await dummyHash()), false);
  if (!user || !valid) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  return openSession(user, 'password', ip, undefined, userAgent);
}

/**
 * Sign devices out by expiring their refresh tokens (not by marking them used): a device that later presents a
 * revoked token then simply gets "expired" instead of tripping the reuse detector, which would also kill the
 * session that did the revoking.
 */
export async function revokeRefreshTokens(userId: string, exceptSessionId?: string | null): Promise<void> {
  await AuthToken.update(
    { expiresAt: new Date(Date.now() - 1000) },
    { where: { userId, type: 'refresh', usedAt: null, expiresAt: { [Op.gt]: new Date() }, ...(exceptSessionId ? { sessionId: { [Op.ne]: exceptSessionId } } : {}) } },
  );
}

async function pruneRefreshTokens(userId: string): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  await AuthToken.destroy({
    where: {
      userId,
      type: 'refresh',
      [Op.or]: [{ expiresAt: { [Op.lt]: new Date() } }, { usedAt: { [Op.lt]: weekAgo } }],
    },
  });
}

/** Rotate the refresh token. Presenting an already-used token revokes every session of that user. */
export async function refresh(rawToken: string | undefined): Promise<Session> {
  if (!rawToken) throw unauthorized('Missing refresh token');
  const record = await AuthToken.findOne({ where: { tokenHash: hashToken(rawToken), type: 'refresh' } });
  if (!record) throw unauthorized('Invalid refresh token');
  if (record.usedAt) {
    await AuthToken.update(
      { usedAt: new Date() },
      { where: { userId: record.userId, type: 'refresh', usedAt: null } },
    );
    throw unauthorized('Refresh token reuse detected, please sign in again');
  }
  if (record.expiresAt.getTime() < Date.now()) throw unauthorized('Refresh token expired', 'TOKEN_EXPIRED');
  const user = await User.findByPk(record.userId);
  if (!user) throw unauthorized('User no longer exists');
  await record.update({ usedAt: new Date() });
  await pruneRefreshTokens(user.id);
  // Keep the sign-in's identity across the rotation so elevation tokens (owner PIN) stay valid.
  return createSession(user, record.sessionId ?? undefined, { ip: record.ip, userAgent: record.userAgent });
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await AuthToken.update(
    { usedAt: new Date() },
    { where: { tokenHash: hashToken(rawToken), type: 'refresh', usedAt: null } },
  );
}

export async function issueOneTimeToken(userId: string, type: 'magic_link' | 'password_reset', ttlMs: number): Promise<string> {
  const raw = generateOpaqueToken(32);
  await AuthToken.create({ userId, tokenHash: hashToken(raw), type, expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function consumeOneTimeToken(raw: string, type: 'magic_link' | 'password_reset'): Promise<User> {
  const record = await AuthToken.findOne({ where: { tokenHash: hashToken(raw), type } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw unauthorized('This link is invalid or has expired');
  }
  const user = await User.findByPk(record.userId);
  if (!user) throw unauthorized('This link is invalid or has expired');
  await record.update({ usedAt: new Date() });
  return user;
}

/** Always resolves; callers respond 200 regardless of whether the email exists. */
export async function requestMagicLink(email: string): Promise<void> {
  const user = await User.findOne({ where: { email }, attributes: ['id', 'email'] });
  if (!user) return;
  const raw = await issueOneTimeToken(user.id, 'magic_link', MAGIC_LINK_TTL_MS);
  // Detached: the response time and failure mode must not reveal whether the account exists.
  void sendMagicLink(user.email, `${env.APP_URL}/auth/magic?token=${encodeURIComponent(raw)}`).catch((err: unknown) =>
    logger.error({ err }, 'Magic link mail failed'),
  );
}

export async function consumeMagicLink(raw: string, ip: string | null = null): Promise<Session> {
  const user = await consumeOneTimeToken(raw, 'magic_link');
  return openSession(user, 'magic_link', ip);
}

/** Phase 11: team invite (e-mail link) and the venue join code both end in a signed-in session. */
export async function acceptInvite(input: AcceptInviteInput, ip: string | null = null): Promise<Session> {
  const { user, restaurantId } = await team.acceptInvite(input);
  return openSession(user, 'invite', ip, [restaurantId]);
}

export async function joinWithCode(input: JoinWithCodeInput, ip: string | null = null): Promise<Session> {
  const { user, restaurantId } = await team.joinWithCode(input, ip);
  return openSession(user, 'join_code', ip, [restaurantId]);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ where: { email }, attributes: ['id', 'email'] });
  if (!user) return;
  const raw = await issueOneTimeToken(user.id, 'password_reset', PASSWORD_RESET_TTL_MS);
  void sendPasswordReset(user.email, `${env.APP_URL}/auth/reset?token=${encodeURIComponent(raw)}`).catch((err: unknown) =>
    logger.error({ err }, 'Password reset mail failed'),
  );
}

export async function resetPassword(raw: string, password: string, ip: string | null = null): Promise<Session> {
  const user = await consumeOneTimeToken(raw, 'password_reset');
  await user.update({ passwordHash: await hashPassword(password), mustChangePassword: false });
  // Changing the password signs out every other device.
  await revokeRefreshTokens(user.id);
  return openSession(user, 'password_reset', ip);
}

export async function me(userId: string): Promise<{ user: UserDto; memberships: MembershipDto[] }> {
  const user = await User.findByPk(userId);
  if (!user) throw unauthorized('User no longer exists');
  return { user: toUserDto(user), memberships: await listMemberships(user.id) };
}
