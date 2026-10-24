import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import * as controller from './controller.js';

/** /api/admin/restaurants/:restaurantId/team — team management is owner-level (PIN-gated when a PIN is set). */
export const teamRouter = Router({ mergeParams: true });
teamRouter.use(requireOwner);
teamRouter.get('/', controller.getTeam);
teamRouter.post('/invites', controller.createInvite);
teamRouter.delete('/invites/:inviteId', controller.revokeInvite);
teamRouter.post('/join-code', controller.createJoinCode);
teamRouter.delete('/join-code', controller.revokeJoinCode);
teamRouter.patch('/:membershipId', controller.updateMember);
teamRouter.delete('/:membershipId', controller.removeMember);
