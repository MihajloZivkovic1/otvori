import type { NextFunction, Request, Response } from 'express';
import {
  copyMenuSchema,
  welcomeEmailSchema,
  slugCheckQuerySchema,
  superadminActivityQuerySchema,
  superadminAddMemberSchema,
  superadminCreateRestaurantSchema,
  superadminInviteSchema,
  superadminListRestaurantsQuerySchema,
  superadminListUsersQuerySchema,
  superadminSearchQuerySchema,
  superadminSetPasswordSchema,
  superadminUpdateMemberSchema,
  superadminUpdateRestaurantSchema,
  superadminUpdateUserSchema,
} from '@qr-menu/shared';
import { noStore, uuidParam } from '../../utils/http.js';
import { runWithActor } from '../audit/context.js';
import { copyMenu } from '../menu-import/service.js';
import * as activity from './activity.js';
import * as members from './members.js';
import * as onboarding from './onboarding.js';
import * as search from './search.js';
import * as service from './service.js';
import * as system from './system.js';
import * as users from './users.js';

/** Superadmin routes skip requireMembership, so the audit context is opened here (role "superadmin"). */
export function adminActorContext(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user!;
  runWithActor({ userId: user.id, name: user.name, email: user.email, role: 'superadmin', elevated: () => true, ip: req.ip ?? null }, next);
}

/* ------------------------------------------------------------------ restaurants */

export async function listRestaurants(req: Request, res: Response): Promise<void> {
  const query = superadminListRestaurantsQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.listRestaurants(query));
}

export async function createRestaurant(req: Request, res: Response): Promise<void> {
  const input = superadminCreateRestaurantSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await service.createRestaurant(input));
}

export async function getRestaurant(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getRestaurantDetail(uuidParam(req.params.id)));
}

export async function updateRestaurant(req: Request, res: Response): Promise<void> {
  const input = superadminUpdateRestaurantSchema.parse(req.body);
  noStore(res);
  res.json(await service.updateRestaurant(uuidParam(req.params.id), input));
}

export async function deleteRestaurant(req: Request, res: Response): Promise<void> {
  await service.deleteRestaurant(uuidParam(req.params.id));
  res.status(204).end();
}

export async function checkSlug(req: Request, res: Response): Promise<void> {
  const query = slugCheckQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.checkSlug(query.slug, query.restaurantId));
}

export async function impersonate(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.status(201).json(await service.impersonate(uuidParam(req.params.id), req.user!));
}

/* ------------------------------------------------------------------ onboarding (Phase 13b) */

export async function copyMenuFrom(req: Request, res: Response): Promise<void> {
  const input = copyMenuSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await copyMenu(uuidParam(req.params.id), input.sourceRestaurantId));
}

export async function welcomeEmail(req: Request, res: Response): Promise<void> {
  const input = welcomeEmailSchema.parse(req.body);
  noStore(res);
  res.json(await onboarding.sendWelcome(uuidParam(req.params.id), req.user!, input));
}

/* ------------------------------------------------------------------ members */

export async function listMembers(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await members.listMembers(uuidParam(req.params.id)));
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const input = superadminAddMemberSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await members.addMember(uuidParam(req.params.id), input));
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const input = superadminUpdateMemberSchema.parse(req.body);
  noStore(res);
  res.json(await members.updateMember(uuidParam(req.params.id), uuidParam(req.params.membershipId, 'membershipId'), input));
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await members.removeMember(uuidParam(req.params.id), uuidParam(req.params.membershipId, 'membershipId')));
}

export async function invite(req: Request, res: Response): Promise<void> {
  const input = superadminInviteSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await members.invite(uuidParam(req.params.id), req.user!, input));
}

export async function revokeInvite(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await members.revokeInvite(uuidParam(req.params.id), req.user!, uuidParam(req.params.inviteId, 'inviteId')));
}

/* ------------------------------------------------------------------ users */

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = superadminListUsersQuerySchema.parse(req.query);
  noStore(res);
  res.json(await users.listUsers(query));
}

export async function getUser(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await users.getUser(uuidParam(req.params.id)));
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const input = superadminUpdateUserSchema.parse(req.body);
  noStore(res);
  res.json(await users.updateUser(uuidParam(req.params.id), req.user!, input));
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await users.sendResetLink(uuidParam(req.params.id)));
}

export async function magicLink(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await users.sendMagicLinkTo(uuidParam(req.params.id)));
}

export async function setPassword(req: Request, res: Response): Promise<void> {
  const input = superadminSetPasswordSchema.parse(req.body);
  noStore(res);
  res.json(await users.setPassword(uuidParam(req.params.id), input));
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await users.deactivateUser(uuidParam(req.params.id), req.user!));
}

export async function activateUser(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await users.activateUser(uuidParam(req.params.id)));
}

/* ------------------------------------------------------------------ activity, system, search */

export async function listActivity(req: Request, res: Response): Promise<void> {
  const query = superadminActivityQuerySchema.parse(req.query);
  noStore(res);
  res.json(await activity.listActivity(query));
}

export async function systemStatus(_req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await system.systemStatus());
}

export async function retryPosJob(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await system.retryFailedJob(uuidParam(req.params.jobId, 'jobId')));
}

export async function globalSearch(req: Request, res: Response): Promise<void> {
  const { q } = superadminSearchQuerySchema.parse(req.query);
  noStore(res);
  res.json(await search.search(q));
}
