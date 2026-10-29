import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { imageUpload } from '../../middleware/upload.js';
import * as controller from './controller.js';

/**
 * Tenant-scoped: /api/admin/restaurants/:restaurantId/promotions[/:promoId…]. Reading is service-level, every
 * change is owner-level (docs/PERMISSIONS.md). The CMS uses these paths so its elevation / impersonation headers
 * attach like for every other venue request.
 */
export const promotionsRouter = Router({ mergeParams: true });
promotionsRouter.get('/', controller.listPromotions);
promotionsRouter.post('/', requireOwner, controller.createPromotion);
promotionsRouter.use('/:promoId', promotionRoutes());

/** /api/admin/promotions/:promoId — the same handlers; admin.router resolves the venue from the promotion. */
export const promotionByIdRouter = promotionRoutes();

function promotionRoutes(): Router {
  const router = Router({ mergeParams: true });
  router.get('/', controller.getPromotion);
  router.patch('/', requireOwner, controller.updatePromotion);
  router.delete('/', requireOwner, controller.deletePromotion);
  router.patch('/toggle', requireOwner, controller.togglePromotion);
  // Same multer + sharp pipeline as the menu-item photo.
  router.post('/image', requireOwner, imageUpload, controller.uploadImage);
  return router;
}
