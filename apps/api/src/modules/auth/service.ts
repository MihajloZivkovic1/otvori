import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import {
  type LoginInput,
  type MembershipDto,
  type RegisterInput,
  type RestaurantSummaryDto,
  type UserDto,
} from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { AuthToken, Membership, Restaurant, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { conflict, unauthorized } from '../../utils/errors.js';
import { signAccessToken } from '../../utils/jwt.js';
import { sendMagicLink, sendPasswordReset } from '../../utils/mailer.js';
import { toIso } from '../../utils/objects.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/tokens.js';
import { createRestaurantWithOwner } from '../restaurants/service.js';

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
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperadmin: user.isSuperadmin,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt.toISOString(),
  };
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

/** Issue an access token + a fresh refresh token (persisted as a hash). */
export async function createSession(user: User): Promise<Session> {
  const { token, expiresIn } = signAccessToken(user.id);
  const refreshToken = generateOpaqueToken(48);
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * DAY_MS);
  await AuthToken.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    type: 'refresh',
    expiresAt: refreshExpiresAt,
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

export async function login(input: LoginInput): Promise<Session> {
  const user = await User.findOne({ where: { email: input.email } });
  // Always run a bcrypt comparison so unknown emails take the same time as wrong passwords.
  const valid = user?.passwordHash
    ? await verifyPassword(input.password, user.passwordHash)
    : (await bcrypt.compare(input.password, await dummyHash()), false);
  if (!user || !valid) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  return createSession(user);
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
  return createSession(user);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await AuthToken.update(
    { usedAt: new Date() },
    { where: { tokenHash: hashToken(rawToken), type: 'refresh', usedAt: null } },
  );
}

async function issueOneTimeToken(userId: string, type: 'magic_link' | 'password_reset', ttlMs: number): Promise<string> {
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
  await sendMagicLink(user.email, `${env.APP_URL}/auth/magic?token=${encodeURIComponent(raw)}`);
}

export async function consumeMagicLink(raw: string): Promise<Session> {
  const user = await consumeOneTimeToken(raw, 'magic_link');
  return createSession(user);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ where: { email }, attributes: ['id', 'email'] });
  if (!user) return;
  const raw = await issueOneTimeToken(user.id, 'password_reset', PASSWORD_RESET_TTL_MS);
  await sendPasswordReset(user.email, `${env.APP_URL}/auth/reset?token=${encodeURIComponent(raw)}`);
}

export async function resetPassword(raw: string, password: string): Promise<Session> {
  const user = await consumeOneTimeToken(raw, 'password_reset');
  await user.update({ passwordHash: await hashPassword(password) });
  // Changing the password signs out every other device.
  await AuthToken.update({ usedAt: new Date() }, { where: { userId: user.id, type: 'refresh', usedAt: null } });
  return createSession(user);
}

export async function me(userId: string): Promise<{ user: UserDto; memberships: MembershipDto[] }> {
  const user = await User.findByPk(userId);
  if (!user) throw unauthorized('User no longer exists');
  return { user: toUserDto(user), memberships: await listMemberships(user.id) };
}
