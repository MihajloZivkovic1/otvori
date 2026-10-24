import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { requireModule } from '../../middleware/modules.js';
import * as controller from './controller.js';

/** /api/admin/restaurants/:restaurantId/pos-config and …/pos/* — POS module on; writes and the sync are owner-only. */
export const posConfigRouter = Router({ mergeParams: true });
posConfigRouter.use(requireModule('pos'));
posConfigRouter.get('/', requireOwner, controller.getPosConfig);
posConfigRouter.patch('/', requireOwner, controller.updatePosConfig);
posConfigRouter.post('/test', requireOwner, controller.testPosConnection);

export const posRouter = Router({ mergeParams: true });
posRouter.use(requireModule('pos'));
posRouter.get('/products', requireOwner, controller.previewSync);
posRouter.post('/sync', requireOwner, controller.applySync);
