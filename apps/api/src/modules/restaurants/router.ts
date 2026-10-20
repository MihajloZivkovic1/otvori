import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { imageUpload } from '../../middleware/upload.js';
import * as controller from './controller.js';

/** Mounted at /api/admin/restaurants/:restaurantId (membership already verified). */
export const restaurantsRouter = Router({ mergeParams: true });

restaurantsRouter.get('/', controller.getRestaurant);
restaurantsRouter.patch('/', requireOwner, controller.updateRestaurant);
restaurantsRouter.delete('/', requireOwner, controller.deleteRestaurant);
restaurantsRouter.post('/logo', requireOwner, imageUpload, controller.uploadLogo);
restaurantsRouter.post('/publish', requireOwner, controller.publishRestaurant);
