import { Op } from 'sequelize';
import type { ChangePasswordInput, MeDto, SessionDto, UpdateProfileInput } from '@qr-menu/shared';
import { AuthToken, User } from '../../db/models/index.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, conflict, forbidden, notFound, unauthorized } from '../../utils/errors.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import * as audit from '../audit/service.js';
import { createSession, listMemberships, revokeRefreshTokens, toUserDto, type Session, type SessionMeta } from './service.js';

/** Account changes are the person's own: an "Open as owner" token may not touch the superadmin's account. */
function assertRealSession(user: AuthUser): void {
  if (user.impersonation) throw forbidden('Account settings are not available while acting as a venue owner');
}

async function loadUser(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw notFound('User not found');
  return user;
}

const platformActor = (user: User) => ({ userId: user.id, name: user.name, email: user.email, role: null, elevated: () => false });

/** PATCH /api/auth/me — name, and the e-mail with the current password. */
export async function updateProfile(auth: AuthUser, input: UpdateProfileInput): Promise<MeDto> {
  assertRealSession(auth);
  const user = await loadUser(auth.id);
  if (input.email && input.email !== user.email) {
    if (!(await verifyPassword(input.currentPassword ?? '', user.passwordHash))) throw unauthorized('Wrong password', 'INVALID_CREDENTIALS');
    const taken = await User.count({ where: { email: input.email, id: { [Op.ne]: user.id } } });
    if (taken) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  }
  await user.update({ ...(input.name !== undefined ? { name: input.name } : {}), ...(input.email !== undefined ? { email: input.email } : {}) });
  return { user: toUserDto(user), memberships: await listMemberships(user.id) };
}

/**
 * POST /api/auth/change-password — verifies the current password, stores the new one, signs every other device
 * out and opens a fresh session for this one (so the caller keeps working). Clears the admin's "must change" flag.
 */
export async function changePassword(auth: AuthUser, input: ChangePasswordInput, meta: SessionMeta): Promise<Session> {
  assertRealSession(auth);
  const user = await loadUser(auth.id);
  if (!user.passwordHash) throw new AppError(409, 'CONFLICT', 'This account signs in with magic links; set a password through "Forgot password"');
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw unauthorized('Wrong current password', 'INVALID_CREDENTIALS');
  if (input.currentPassword === input.newPassword) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a different password', [{ path: 'newPassword', message: 'The new password must differ from the current one' }]);
  await user.update({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false });
  await revokeRefreshTokens(user.id);
  await audit.record({ restaurantId: null, action: 'auth.password_change', entity: { type: 'user', id: user.id, label: user.email }, actor: platformActor(user) });
  return createSession(user, undefined, meta);
}

/** GET /api/auth/sessions — one row per sign-in (refresh tokens grouped by session id), newest first. */
export async function listSessions(auth: AuthUser): Promise<SessionDto[]> {
  assertRealSession(auth);
  const rows = await AuthToken.findAll({
    where: { userId: auth.id, type: 'refresh', usedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });
  const first = await AuthToken.findAll({
    where: { userId: auth.id, type: 'refresh', sessionId: rows.map((r) => r.sessionId).filter((s): s is string => Boolean(s)) },
    attributes: ['sessionId', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  const startedAt = new Map<string, Date>();
  for (const row of first) if (row.sessionId && !startedAt.has(row.sessionId)) startedAt.set(row.sessionId, row.createdAt);
  const seen = new Set<string>();
  const sessions: SessionDto[] = [];
  for (const row of rows) {
    const id = row.sessionId ?? row.id;
    if (seen.has(id)) continue;
    seen.add(id);
    sessions.push({
      id,
      createdAt: (startedAt.get(id) ?? row.createdAt).toISOString(),
      lastUsedAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
      current: auth.sessionId !== null && id === auth.sessionId,
    });
  }
  return sessions;
}

/** DELETE /api/auth/sessions — "sign out everywhere else": every refresh token but this sign-in's. */
export async function revokeOtherSessions(auth: AuthUser): Promise<SessionDto[]> {
  assertRealSession(auth);
  await revokeRefreshTokens(auth.id, auth.sessionId);
  const user = await loadUser(auth.id);
  await audit.record({ restaurantId: null, action: 'auth.sessions_revoke', entity: { type: 'user', id: user.id, label: user.email }, actor: platformActor(user) });
  return listSessions(auth);
}

/** DELETE /api/auth/sessions/:id — one device. */
export async function revokeSession(auth: AuthUser, sessionId: string): Promise<SessionDto[]> {
  assertRealSession(auth);
  await AuthToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { userId: auth.id, type: 'refresh', usedAt: null, sessionId } });
  return listSessions(auth);
}
