import { Op, type Order as SequelizeOrder, type WhereOptions } from 'sequelize';
import {
  type PaginatedDto,
  type SuperadminListUsersQuery,
  type SuperadminSetPasswordInput,
  type SuperadminUpdateUserInput,
  type SuperadminUserDto,
  type SuperadminUserLinkDto,
} from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { Membership, Restaurant, User } from '../../db/models/index.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { sendMagicLink, sendPasswordReset } from '../../utils/mailer.js';
import { toIso } from '../../utils/objects.js';
import { hashPassword } from '../../utils/password.js';
import * as audit from '../audit/service.js';
import { issueOneTimeToken, revokeRefreshTokens } from '../auth/service.js';
import { isSyntheticEmail } from '../team/service.js';
import { escapeLike } from './service.js';

const HOUR_MS = 3_600_000;
/** Admin-sent links are generous: the owner may open the mail the next day. */
const ADMIN_RESET_TTL_MS = 24 * HOUR_MS;
const ADMIN_MAGIC_TTL_MS = HOUR_MS;

const MEMBERSHIP_INCLUDE = { model: Membership, include: [{ model: Restaurant, attributes: ['id', 'name', 'slug', 'status'] }] };

export function toUserDto(user: User): SuperadminUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    isSuperadmin: user.isSuperadmin,
    hasPassword: Boolean(user.passwordHash),
    hasRealEmail: !isSyntheticEmail(user.email),
    mustChangePassword: user.mustChangePassword,
    deactivatedAt: toIso(user.deactivatedAt),
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    memberships: (user.memberships ?? [])
      .filter((m) => m.restaurant)
      .sort((a, b) => a.restaurant!.name.localeCompare(b.restaurant!.name))
      .map((m) => ({
        membershipId: m.id,
        role: m.role,
        restaurant: { id: m.restaurant!.id, name: m.restaurant!.name, slug: m.restaurant!.slug, status: m.restaurant!.status },
      })),
  };
}

// Model attributes, not literals: with an include + limit Sequelize wraps the page in a subquery whose columns are
// already aliased (created_at → "createdAt"), so a raw column name in ORDER BY would not resolve.
const SORT_COLUMNS: Record<SuperadminListUsersQuery['sort'], 'name' | 'email' | 'lastLoginAt' | 'createdAt'> = {
  name: 'name',
  email: 'email',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
};

export async function listUsers(query: SuperadminListUsersQuery): Promise<PaginatedDto<SuperadminUserDto>> {
  const where: WhereOptions<User> = {
    ...(query.superadmin !== undefined ? { isSuperadmin: query.superadmin } : {}),
    ...(query.deactivated !== undefined ? { deactivatedAt: query.deactivated ? { [Op.ne]: null } : null } : {}),
  };
  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    Object.assign(where, { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { email: { [Op.iLike]: pattern } }, { phone: { [Op.iLike]: pattern } }] });
  }
  const order: SequelizeOrder = [[SORT_COLUMNS[query.sort], `${query.dir.toUpperCase()} NULLS LAST`], ['email', 'ASC']];
  const { rows, count } = await User.findAndCountAll({
    where,
    include: [MEMBERSHIP_INCLUDE],
    order,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    distinct: true,
  });
  return { items: rows.map(toUserDto), total: count, page: query.page, pageSize: query.pageSize };
}

async function loadUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId, { include: [MEMBERSHIP_INCLUDE] });
  if (!user) throw notFound('User not found');
  return user;
}

export async function getUser(userId: string): Promise<SuperadminUserDto> {
  return toUserDto(await loadUser(userId));
}

export async function updateUser(userId: string, admin: AuthUser, input: SuperadminUpdateUserInput): Promise<SuperadminUserDto> {
  const user = await loadUser(userId);
  if (input.isSuperadmin === false && user.isSuperadmin) {
    if (user.id === admin.id) throw conflict('CONFLICT', 'You cannot remove your own superadmin access');
    const others = await User.count({ where: { isSuperadmin: true, id: { [Op.ne]: user.id } } });
    if (others === 0) throw conflict('CONFLICT', 'At least one superadmin must remain');
  }
  const before = { name: user.name, phone: user.phone ?? null, isSuperadmin: user.isSuperadmin, mustChangePassword: user.mustChangePassword };
  await user.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.isSuperadmin !== undefined ? { isSuperadmin: input.isSuperadmin } : {}),
    ...(input.mustChangePassword !== undefined ? { mustChangePassword: input.mustChangePassword } : {}),
  });
  const changes = audit.diff(before, { name: user.name, phone: user.phone ?? null, isSuperadmin: user.isSuperadmin, mustChangePassword: user.mustChangePassword });
  if (changes) await audit.record({ restaurantId: null, action: 'admin.user_update', entity: { type: 'user', id: user.id, label: user.email }, ...changes });
  return toUserDto(user);
}

async function revokeSessions(userId: string): Promise<void> {
  await revokeRefreshTokens(userId);
}

/** POST …/users/:id/reset-password — a 24-hour set-password link, mailed when the address is real, returned always. */
export async function sendResetLink(userId: string): Promise<SuperadminUserLinkDto> {
  const user = await loadUser(userId);
  if (user.deactivatedAt) throw conflict('CONFLICT', 'This account is deactivated');
  const raw = await issueOneTimeToken(user.id, 'password_reset', ADMIN_RESET_TTL_MS);
  const url = `${env.APP_URL}/auth/reset?token=${encodeURIComponent(raw)}`;
  const mailed = !isSyntheticEmail(user.email);
  if (mailed) void sendPasswordReset(user.email, url).catch((err: unknown) => logger.error({ err }, 'Admin reset mail failed'));
  await audit.record({ restaurantId: null, action: 'admin.user_reset_password', entity: { type: 'user', id: user.id, label: user.email }, after: { mailed } });
  return { ok: true, mailed, url, expiresAt: new Date(Date.now() + ADMIN_RESET_TTL_MS).toISOString() };
}

/** POST …/users/:id/magic-link — a one-hour sign-in link. */
export async function sendMagicLinkTo(userId: string): Promise<SuperadminUserLinkDto> {
  const user = await loadUser(userId);
  if (user.deactivatedAt) throw conflict('CONFLICT', 'This account is deactivated');
  const raw = await issueOneTimeToken(user.id, 'magic_link', ADMIN_MAGIC_TTL_MS);
  const url = `${env.APP_URL}/auth/magic?token=${encodeURIComponent(raw)}`;
  const mailed = !isSyntheticEmail(user.email);
  if (mailed) void sendMagicLink(user.email, url).catch((err: unknown) => logger.error({ err }, 'Admin magic link mail failed'));
  await audit.record({ restaurantId: null, action: 'admin.user_magic_link', entity: { type: 'user', id: user.id, label: user.email }, after: { mailed } });
  return { ok: true, mailed, url, expiresAt: new Date(Date.now() + ADMIN_MAGIC_TTL_MS).toISOString() };
}

/** POST …/users/:id/password — the admin sets the password directly (other devices are signed out). */
export async function setPassword(userId: string, input: SuperadminSetPasswordInput): Promise<SuperadminUserDto> {
  const user = await loadUser(userId);
  await user.update({ passwordHash: await hashPassword(input.password), mustChangePassword: input.mustChangePassword });
  await revokeSessions(user.id);
  await audit.record({ restaurantId: null, action: 'admin.user_update', entity: { type: 'user', id: user.id, label: user.email }, after: { password: 'set', mustChangePassword: input.mustChangePassword } });
  return toUserDto(user);
}

export async function deactivateUser(userId: string, admin: AuthUser): Promise<SuperadminUserDto> {
  const user = await loadUser(userId);
  if (user.id === admin.id) throw conflict('CONFLICT', 'You cannot deactivate your own account');
  if (user.isSuperadmin) throw conflict('CONFLICT', 'Remove superadmin access before deactivating this account');
  if (!user.deactivatedAt) {
    await user.update({ deactivatedAt: new Date() });
    await revokeSessions(user.id);
    await audit.record({ restaurantId: null, action: 'admin.user_deactivate', entity: { type: 'user', id: user.id, label: user.email } });
  }
  return toUserDto(user);
}

export async function activateUser(userId: string): Promise<SuperadminUserDto> {
  const user = await loadUser(userId);
  if (user.deactivatedAt) {
    await user.update({ deactivatedAt: null });
    await audit.record({ restaurantId: null, action: 'admin.user_activate', entity: { type: 'user', id: user.id, label: user.email } });
  }
  return toUserDto(user);
}

/** Guard for the one-way doors above: a plain object error the controller can map (never silently ignored). */
export function assertNotSelf(userId: string, admin: AuthUser, message: string): void {
  if (userId === admin.id) throw new AppError(409, 'CONFLICT', message);
}
