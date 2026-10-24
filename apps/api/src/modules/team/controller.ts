import type { Request, Response } from 'express';
import { createInviteSchema, updateMemberSchema } from '@qr-menu/shared';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import * as service from './service.js';

export async function getTeam(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getTeam(restaurantIdOf(req), req.user!));
}

export async function createInvite(req: Request, res: Response): Promise<void> {
  const input = createInviteSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await service.createInvite(restaurantIdOf(req), req.user!, input));
}

export async function revokeInvite(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.revokeInvite(restaurantIdOf(req), req.user!, uuidParam(req.params.inviteId, 'inviteId')));
}

export async function createJoinCode(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.status(201).json(await service.createJoinCode(restaurantIdOf(req), req.user!));
}

export async function revokeJoinCode(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.revokeJoinCode(restaurantIdOf(req), req.user!));
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const input = updateMemberSchema.parse(req.body);
  noStore(res);
  res.json(await service.updateMember(restaurantIdOf(req), req.user!, uuidParam(req.params.membershipId, 'membershipId'), input));
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.removeMember(restaurantIdOf(req), req.user!, uuidParam(req.params.membershipId, 'membershipId')));
}
