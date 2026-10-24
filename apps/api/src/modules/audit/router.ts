import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import * as controller from './controller.js';

/** /api/admin/restaurants/:restaurantId/audit-log — owner only (it shows what every member did). */
export const auditRouter = Router({ mergeParams: true });
auditRouter.get('/', requireOwner, controller.list);
