import { Router } from 'express';
import { requireAuth, requireSuperadmin } from '../../middleware/auth.js';
import * as controller from './controller.js';

/**
 * /api/superadmin/* — the admin area (Phase 13). Only real superadmin sessions: an "Open as owner" token reads as
 * a non-superadmin here, so the admin API is out of reach while impersonating.
 */
export const superadminRouter = Router();

superadminRouter.use(requireAuth, requireSuperadmin, controller.adminActorContext);

superadminRouter.get('/restaurants', controller.listRestaurants);
superadminRouter.post('/restaurants', controller.createRestaurant);
superadminRouter.get('/slug-check', controller.checkSlug);
superadminRouter.get('/restaurants/:id', controller.getRestaurant);
superadminRouter.patch('/restaurants/:id', controller.updateRestaurant);
superadminRouter.delete('/restaurants/:id', controller.deleteRestaurant);
superadminRouter.post('/restaurants/:id/impersonate', controller.impersonate);

superadminRouter.get('/restaurants/:id/members', controller.listMembers);
superadminRouter.post('/restaurants/:id/members', controller.addMember);
superadminRouter.patch('/restaurants/:id/members/:membershipId', controller.updateMember);
superadminRouter.delete('/restaurants/:id/members/:membershipId', controller.removeMember);
superadminRouter.post('/restaurants/:id/invites', controller.invite);
superadminRouter.delete('/restaurants/:id/invites/:inviteId', controller.revokeInvite);

superadminRouter.get('/users', controller.listUsers);
superadminRouter.get('/users/:id', controller.getUser);
superadminRouter.patch('/users/:id', controller.updateUser);
superadminRouter.post('/users/:id/reset-password', controller.resetPassword);
superadminRouter.post('/users/:id/magic-link', controller.magicLink);
superadminRouter.post('/users/:id/password', controller.setPassword);
superadminRouter.post('/users/:id/deactivate', controller.deactivateUser);
superadminRouter.post('/users/:id/activate', controller.activateUser);

superadminRouter.get('/activity', controller.listActivity);
superadminRouter.get('/system', controller.systemStatus);
superadminRouter.post('/system/pos-jobs/:jobId/retry', controller.retryPosJob);
superadminRouter.get('/search', controller.globalSearch);
