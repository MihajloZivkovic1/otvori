import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership } from '../middleware/membership.js';
import { analyticsRouter } from './analytics/router.js';
import { categoriesRouter } from './categories/router.js';
import { itemsRouter } from './items/router.js';
import { restaurantsRouter } from './restaurants/router.js';
import { tablesRouter } from './tables/router.js';

/** /api/admin/restaurants/:restaurantId/... — every route below is tenant-scoped by requireMembership. */
export const adminRouter = Router();

const scoped = Router({ mergeParams: true });
scoped.use('/categories', categoriesRouter);
scoped.use('/items', itemsRouter);
scoped.use('/tables', tablesRouter);
scoped.use('/analytics', analyticsRouter);
scoped.use('/', restaurantsRouter);

adminRouter.use('/restaurants/:restaurantId', requireAuth, requireMembership(), scoped);
