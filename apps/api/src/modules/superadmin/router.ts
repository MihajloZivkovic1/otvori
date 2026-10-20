import { Router } from 'express';
import { requireAuth, requireSuperadmin } from '../../middleware/auth.js';
import * as controller from './controller.js';

export const superadminRouter = Router();

superadminRouter.use(requireAuth, requireSuperadmin);
superadminRouter.get('/restaurants', controller.listRestaurants);
superadminRouter.patch('/restaurants/:id', controller.updateRestaurant);
