import { Router } from 'express';
import { requireOwnerRole } from '../../middleware/membership.js';
import * as controller from './controller.js';

/**
 * /api/admin/restaurants/:restaurantId/security — owner role only, but deliberately WITHOUT the elevation gate:
 * these are the routes that create elevation (unlock / extend) or prove the owner with the password (PIN set / remove).
 * GET is open to every member (the CMS reads `pinSet` and the digest preference from it).
 */
export const securityRouter = Router({ mergeParams: true });
securityRouter.get('/', controller.getSecurity);
securityRouter.patch('/', requireOwnerRole, controller.updateSecurity);
securityRouter.put('/pin', requireOwnerRole, controller.setPin);
securityRouter.delete('/pin', requireOwnerRole, controller.removePin);
securityRouter.post('/unlock', requireOwnerRole, controller.unlock);
securityRouter.post('/extend', requireOwnerRole, controller.extend);
