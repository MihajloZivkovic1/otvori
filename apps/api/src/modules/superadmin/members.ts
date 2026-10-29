import {
  type SuperadminAddMemberInput,
  type SuperadminAddMemberResultDto,
  type SuperadminInviteInput,
  type SuperadminMemberDto,
  type SuperadminUpdateMemberInput,
  type TeamInviteDto,
} from '@qr-menu/shared';
import { Membership, Restaurant, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { hashPassword } from '../../utils/password.js';
import { toIso } from '../../utils/objects.js';
import * as audit from '../audit/service.js';
import * as team from '../team/service.js';

export function toMemberDto(membership: Membership): SuperadminMemberDto {
  const user = membership.user;
  return {
    membershipId: membership.id,
    userId: membership.userId,
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? null,
    role: membership.role,
    hasPassword: Boolean(user?.passwordHash),
    hasRealEmail: !team.isSyntheticEmail(user?.email ?? ''),
    mustChangePassword: user?.mustChangePassword ?? false,
    lastLoginAt: toIso(user?.lastLoginAt),
    deactivatedAt: toIso(user?.deactivatedAt),
  };
}

const USER_ATTRIBUTES = ['id', 'name', 'email', 'phone', 'passwordHash', 'mustChangePassword', 'lastLoginAt', 'deactivatedAt', 'createdAt'];

export async function listMembers(restaurantId: string): Promise<SuperadminMemberDto[]> {
  const members = await Membership.findAll({ where: { restaurantId }, include: [{ model: User, attributes: USER_ATTRIBUTES }] });
  return members
    .sort((a, b) => (a.role === b.role ? (a.user?.name ?? '').localeCompare(b.user?.name ?? '') : a.role === 'owner' ? -1 : 1))
    .map(toMemberDto);
}

async function assertRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'name'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

/**
 * POST /api/superadmin/restaurants/:id/members — the wizard's step 2 and the detail page's "Add member".
 * An existing account (by e-mail) is attached; otherwise one is created with the admin-typed password.
 */
export async function addMember(restaurantId: string, input: SuperadminAddMemberInput): Promise<SuperadminAddMemberResultDto> {
  const restaurant = await assertRestaurant(restaurantId);
  const { membership, created } = await sequelize.transaction(async (transaction) => {
    let user = await User.findOne({ where: { email: input.email }, transaction });
    let created = false;
    if (!user) {
      const missing: { path: string; message: string }[] = [];
      if (!input.name) missing.push({ path: 'name', message: 'Name is required for a new account' });
      if (!input.password) missing.push({ path: 'password', message: 'Password is required for a new account' });
      if (missing.length) throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', missing);
      user = await User.create(
        {
          email: input.email,
          name: input.name!,
          passwordHash: await hashPassword(input.password!),
          mustChangePassword: input.mustChangePassword,
          phone: input.phone ?? null,
        },
        { transaction },
      );
      created = true;
    } else if (input.phone !== undefined) {
      await user.update({ phone: input.phone }, { transaction });
    }
    const existing = await Membership.findOne({ where: { restaurantId, userId: user.id }, transaction });
    if (existing) throw conflict('CONFLICT', `${user.email} is already a member of ${restaurant.name}`);
    const membership = await Membership.create({ restaurantId, userId: user.id, role: input.role }, { transaction });
    return { membership, created };
  });
  const full = (await Membership.findByPk(membership.id, { include: [{ model: User, attributes: USER_ATTRIBUTES }] }))!;
  await audit.record({
    restaurantId,
    action: 'admin.member_add',
    entity: { type: 'member', id: full.userId, label: full.user?.name ?? full.user?.email ?? null },
    after: { role: input.role, email: input.email, created, mustChangePassword: created ? input.mustChangePassword : undefined },
  });
  return { member: toMemberDto(full), created, members: await listMembers(restaurantId) };
}

async function loadMembership(restaurantId: string, membershipId: string): Promise<Membership> {
  const membership = await Membership.findOne({ where: { id: membershipId, restaurantId }, include: [{ model: User, attributes: USER_ATTRIBUTES }] });
  if (!membership) throw notFound('Member not found');
  return membership;
}

async function assertNotLastOwner(restaurantId: string, membership: Membership): Promise<void> {
  if (membership.role !== 'owner') return;
  const owners = await Membership.count({ where: { restaurantId, role: 'owner' } });
  if (owners <= 1) throw new AppError(409, 'LAST_OWNER', 'A venue needs at least one owner');
}

export async function updateMember(restaurantId: string, membershipId: string, input: SuperadminUpdateMemberInput): Promise<SuperadminMemberDto[]> {
  const membership = await loadMembership(restaurantId, membershipId);
  if (membership.role !== input.role) {
    if (input.role === 'staff') await assertNotLastOwner(restaurantId, membership);
    const before = membership.role;
    await membership.update({ role: input.role });
    await audit.record({
      restaurantId,
      action: 'admin.member_role',
      entity: { type: 'member', id: membership.userId, label: membership.user?.name ?? membership.user?.email ?? null },
      before: { role: before },
      after: { role: input.role },
    });
  }
  return listMembers(restaurantId);
}

export async function removeMember(restaurantId: string, membershipId: string): Promise<SuperadminMemberDto[]> {
  const membership = await loadMembership(restaurantId, membershipId);
  await assertNotLastOwner(restaurantId, membership);
  await membership.destroy();
  await audit.record({
    restaurantId,
    action: 'admin.member_remove',
    entity: { type: 'member', id: membership.userId, label: membership.user?.name ?? membership.user?.email ?? null },
    before: { role: membership.role },
  });
  return listMembers(restaurantId);
}

/** POST …/invites — the ordinary e-mail invite (team.invite audit row, 7-day link), sent as the superadmin. */
export async function invite(restaurantId: string, admin: AuthUser, input: SuperadminInviteInput): Promise<TeamInviteDto[]> {
  await assertRestaurant(restaurantId);
  const result = await team.createInvite(restaurantId, admin, input);
  return result.invites;
}

export async function revokeInvite(restaurantId: string, admin: AuthUser, inviteId: string): Promise<TeamInviteDto[]> {
  const result = await team.revokeInvite(restaurantId, admin, inviteId);
  return result.invites;
}
