import { Op } from 'sequelize';
import {
  TEAM_LIMITS,
  type AcceptInviteInput,
  type CreateInviteInput,
  type InvitePreviewDto,
  type JoinCodeDto,
  type JoinWithCodeInput,
  type TeamDto,
  type TeamInviteDto,
  type TeamMemberDto,
  type UpdateMemberInput,
} from '@qr-menu/shared';
import { randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { Membership, Restaurant, TeamInvite, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { sendTeamInvite } from '../../utils/mailer.js';
import { hashPassword } from '../../utils/password.js';
import { slugify } from '../../utils/slug.js';
import { generateOpaqueToken, hashToken } from '../../utils/tokens.js';
import * as audit from '../audit/service.js';

/** Accounts created with a join code and no e-mail sign in with `<handle>@<slug>.staff.otvori.menu`. */
export const STAFF_EMAIL_SUFFIX = '.staff.otvori.menu';
export const isSyntheticEmail = (email: string): boolean => email.endsWith(STAFF_EMAIL_SUFFIX);

const DAY_MS = 86_400_000;
const inviteInvalid = () => new AppError(410, 'INVITE_INVALID', 'This invite link is invalid or has expired');
const codeInvalid = () => new AppError(404, 'JOIN_CODE_INVALID', 'This join code is wrong or has expired');

function toMemberDto(m: Membership, selfId: string): TeamMemberDto {
  return {
    membershipId: m.id,
    userId: m.userId,
    name: m.user?.name ?? '',
    email: m.user?.email ?? '',
    role: m.role,
    isSelf: m.userId === selfId,
    hasRealEmail: !isSyntheticEmail(m.user?.email ?? ''),
  };
}

function toInviteDto(invite: TeamInvite): TeamInviteDto {
  return {
    id: invite.id,
    email: invite.email ?? '',
    role: invite.role,
    invitedBy: invite.inviter?.name ?? null,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  };
}

const activeInviteWhere = (now: Date) => ({ usedAt: null, revokedAt: null, expiresAt: { [Op.gt]: now } });

export async function getTeam(restaurantId: string, user: AuthUser, now = new Date()): Promise<TeamDto> {
  const [members, invites, code] = await Promise.all([
    Membership.findAll({ where: { restaurantId }, include: [{ model: User, attributes: ['id', 'name', 'email'] }] }),
    TeamInvite.findAll({
      where: { restaurantId, kind: 'email', ...activeInviteWhere(now) },
      include: [{ model: User, as: 'inviter', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
    }),
    TeamInvite.findOne({ where: { restaurantId, kind: 'code', ...activeInviteWhere(now) }, order: [['createdAt', 'DESC']] }),
  ]);
  const sorted = members.sort((a, b) => (a.role === b.role ? (a.user?.name ?? '').localeCompare(b.user?.name ?? '') : a.role === 'owner' ? -1 : 1));
  return {
    members: sorted.map((m) => toMemberDto(m, user.id)),
    invites: invites.map(toInviteDto),
    joinCode: code?.code ? { code: code.code, expiresAt: code.expiresAt.toISOString() } : null,
  };
}

/** E-mail invite: a 7-day one-time link; an existing account just gets the membership, a new one is created on accept. */
export async function createInvite(restaurantId: string, user: AuthUser, input: CreateInviteInput): Promise<TeamDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'name'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  const existing = await User.findOne({ where: { email: input.email }, attributes: ['id'] });
  if (existing) {
    const member = await Membership.count({ where: { restaurantId, userId: existing.id } });
    if (member) throw conflict('CONFLICT', 'That person is already a member of this venue');
  }
  const raw = generateOpaqueToken(32);
  await TeamInvite.update(
    { revokedAt: new Date() },
    { where: { restaurantId, kind: 'email', email: input.email, usedAt: null, revokedAt: null } },
  );
  await TeamInvite.create({
    restaurantId,
    kind: 'email',
    email: input.email,
    role: input.role,
    tokenHash: hashToken(raw),
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + TEAM_LIMITS.inviteDays * DAY_MS),
  });
  const url = `${env.APP_URL}/auth/invite?token=${encodeURIComponent(raw)}`;
  void sendTeamInvite(input.email, { venue: restaurant.name, inviter: user.name, role: input.role, url }).catch((err: unknown) =>
    logger.error({ err }, 'Invite mail failed'),
  );
  await audit.record({ restaurantId, action: 'team.invite', entity: { type: 'invite', label: input.email }, after: { role: input.role } });
  return getTeam(restaurantId, user);
}

export async function revokeInvite(restaurantId: string, user: AuthUser, inviteId: string): Promise<TeamDto> {
  const invite = await TeamInvite.findOne({ where: { id: inviteId, restaurantId, kind: 'email' } });
  if (!invite) throw notFound('Invite not found');
  if (!invite.revokedAt && !invite.usedAt) {
    await invite.update({ revokedAt: new Date() });
    await audit.record({ restaurantId, action: 'team.invite_revoke', entity: { type: 'invite', id: invite.id, label: invite.email } });
  }
  return getTeam(restaurantId, user);
}

/** A fresh 6-digit code valid 24 h; generating one retires the previous code. */
export async function createJoinCode(restaurantId: string, user: AuthUser): Promise<JoinCodeDto> {
  const now = new Date();
  await TeamInvite.update({ revokedAt: now }, { where: { restaurantId, kind: 'code', revokedAt: null } });
  const code = String(randomInt(0, 10 ** TEAM_LIMITS.joinCodeLength)).padStart(TEAM_LIMITS.joinCodeLength, '0');
  const invite = await TeamInvite.create({
    restaurantId,
    kind: 'code',
    role: 'staff',
    code,
    invitedBy: user.id,
    expiresAt: new Date(now.getTime() + TEAM_LIMITS.joinCodeHours * 3_600_000),
  });
  await audit.record({ restaurantId, action: 'team.join_code', after: { expiresAt: invite.expiresAt.toISOString() } });
  return { code, expiresAt: invite.expiresAt.toISOString() };
}

export async function revokeJoinCode(restaurantId: string, user: AuthUser): Promise<TeamDto> {
  await TeamInvite.update({ revokedAt: new Date() }, { where: { restaurantId, kind: 'code', revokedAt: null } });
  return getTeam(restaurantId, user);
}

async function assertNotLastOwner(restaurantId: string, membership: Membership): Promise<void> {
  if (membership.role !== 'owner') return;
  const owners = await Membership.count({ where: { restaurantId, role: 'owner' } });
  if (owners <= 1) throw new AppError(409, 'LAST_OWNER', 'A venue needs at least one owner');
}

export async function updateMember(restaurantId: string, user: AuthUser, membershipId: string, input: UpdateMemberInput): Promise<TeamDto> {
  const membership = await Membership.findOne({ where: { id: membershipId, restaurantId }, include: [{ model: User, attributes: ['name', 'email'] }] });
  if (!membership) throw notFound('Member not found');
  if (membership.role !== input.role) {
    if (input.role === 'staff') await assertNotLastOwner(restaurantId, membership);
    const before = membership.role;
    await membership.update({ role: input.role });
    await audit.record({
      restaurantId,
      action: 'team.role',
      entity: { type: 'member', id: membership.userId, label: membership.user?.name ?? membership.user?.email ?? null },
      before: { role: before },
      after: { role: input.role },
    });
  }
  return getTeam(restaurantId, user);
}

export async function removeMember(restaurantId: string, user: AuthUser, membershipId: string): Promise<TeamDto> {
  const membership = await Membership.findOne({ where: { id: membershipId, restaurantId }, include: [{ model: User, attributes: ['name', 'email'] }] });
  if (!membership) throw notFound('Member not found');
  await assertNotLastOwner(restaurantId, membership);
  await membership.destroy();
  await audit.record({
    restaurantId,
    action: 'team.remove',
    entity: { type: 'member', id: membership.userId, label: membership.user?.name ?? membership.user?.email ?? null },
    before: { role: membership.role },
  });
  return getTeam(restaurantId, user);
}

/* ------------------------------------------------------------------ public side (/api/auth) */

async function loadInvite(raw: string, now = new Date()): Promise<TeamInvite> {
  const invite = await TeamInvite.findOne({
    where: { tokenHash: hashToken(raw), kind: 'email', ...activeInviteWhere(now) },
    include: [{ model: Restaurant, attributes: ['id', 'name'] }],
  });
  if (!invite || !invite.restaurant || !invite.email) throw inviteInvalid();
  return invite;
}

export async function previewInvite(raw: string): Promise<InvitePreviewDto> {
  const invite = await loadInvite(raw);
  const existing = await User.count({ where: { email: invite.email! } });
  return { restaurantName: invite.restaurant!.name, role: invite.role, email: invite.email!, existingUser: existing > 0 };
}

/** Consumes the invite: creates the account if needed, adds the membership, returns the user to sign in. */
export async function acceptInvite(input: AcceptInviteInput): Promise<{ user: User; restaurantId: string; created: boolean }> {
  const invite = await loadInvite(input.token);
  const email = invite.email!;
  const result = await sequelize.transaction(async (transaction) => {
    let user = await User.findOne({ where: { email }, transaction });
    let created = false;
    if (!user) {
      if (!input.name) throw new AppError(400, 'VALIDATION_ERROR', 'Your name is required', [{ path: 'name', message: 'Name is required' }]);
      user = await User.create(
        { email, name: input.name, passwordHash: input.password ? await hashPassword(input.password) : null },
        { transaction },
      );
      created = true;
    }
    const member = await Membership.findOne({ where: { restaurantId: invite.restaurantId, userId: user.id }, transaction });
    if (!member) await Membership.create({ restaurantId: invite.restaurantId, userId: user.id, role: invite.role }, { transaction });
    await invite.update({ usedAt: new Date() }, { transaction });
    return { user, restaurantId: invite.restaurantId, created };
  });
  // After the commit: the audit row references the (possibly new) user.
  await audit.record({
    restaurantId: result.restaurantId,
    action: 'team.join',
    entity: { type: 'member', id: result.user.id, label: result.user.name },
    after: { role: invite.role, via: 'invite' },
    actor: { userId: result.user.id, name: result.user.name, email: result.user.email, role: invite.role, elevated: () => false, ip: null },
  });
  return result;
}

async function uniqueStaffEmail(name: string, slug: string, transaction: import('sequelize').Transaction): Promise<string> {
  const handle = slugify(name).replace(/-/g, '.') || 'konobar';
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `${handle}${attempt === 0 ? '' : attempt + 1}@${slug}${STAFF_EMAIL_SUFFIX}`;
    const taken = await User.count({ where: { email: candidate }, transaction });
    if (!taken) return candidate;
  }
  return `${handle}.${generateOpaqueToken(4).toLowerCase().replace(/[^a-z0-9]/g, '')}@${slug}${STAFF_EMAIL_SUFFIX}`;
}

/**
 * "Konobarski nalog": the 6-digit code from the Team card + a name and password → a staff account on that venue.
 * Without an e-mail the account gets a synthetic sign-in address (shown once on the success screen).
 */
export async function joinWithCode(input: JoinWithCodeInput, ip: string | null): Promise<{ user: User; restaurantId: string }> {
  const invite = await TeamInvite.findOne({
    where: { code: input.code, kind: 'code', ...activeInviteWhere(new Date()) },
    include: [{ model: Restaurant, attributes: ['id', 'name', 'slug'] }],
  });
  if (!invite?.restaurant) throw codeInvalid();
  const restaurant = invite.restaurant;
  const user = await sequelize.transaction(async (transaction) => {
    if (input.email) {
      const taken = await User.findOne({ where: { email: input.email }, transaction });
      if (taken) throw conflict('EMAIL_TAKEN', 'An account with this email already exists — sign in and ask the owner for an invite');
    }
    const email = input.email ?? (await uniqueStaffEmail(input.name, restaurant.slug, transaction));
    const created = await User.create({ email, name: input.name, passwordHash: await hashPassword(input.password) }, { transaction });
    await Membership.create({ restaurantId: restaurant.id, userId: created.id, role: 'staff' }, { transaction });
    return created;
  });
  await audit.record({
    restaurantId: restaurant.id,
    action: 'team.join',
    entity: { type: 'member', id: user.id, label: user.name },
    after: { role: 'staff', via: 'join_code', email: user.email },
    actor: { userId: user.id, name: user.name, email: user.email, role: 'staff', elevated: () => false, ip },
  });
  return { user, restaurantId: restaurant.id };
}
