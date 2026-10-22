import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership } from '../middleware/membership.js';
import { requireModule } from '../middleware/modules.js';
import { analyticsRouter } from './analytics/router.js';
import { categoriesRouter } from './categories/router.js';
import { itemsRouter } from './items/router.js';
import * as orderingController from './ordering/controller.js';
import { ordersRouter, requestsRouter } from './ordering/router.js';
import { requireSseToken, streamEvents } from './ordering/sse.js';
import * as restaurantsController from './restaurants/controller.js';
import { restaurantsRouter } from './restaurants/router.js';
import { tablesRouter } from './tables/router.js';

/** /api/admin/restaurants/:restaurantId/... — every route below is tenant-scoped by requireMembership. */
export const adminRouter = Router();

// The one admin route without a :restaurantId: it creates the venue the caller will own.
adminRouter.post('/restaurants', requireAuth, restaurantsController.createRestaurant);

// Server-Sent Events for the waiter screen. EventSource cannot send a bearer header, so this route authenticates
// with the short-lived token from POST /sse-token (which does go through requireAuth + requireMembership).
adminRouter.get('/restaurants/:restaurantId/events', requireSseToken, requireModule('ordering'), streamEvents);

const scoped = Router({ mergeParams: true });
scoped.use('/categories', categoriesRouter);
scoped.use('/items', itemsRouter);
scoped.use('/tables', tablesRouter);
scoped.use('/analytics', analyticsRouter);
// Ordering module (Phase 9b): 403 MODULE_DISABLED for venues without it, whatever the UI shows.
scoped.use('/orders', requireModule('ordering'), ordersRouter);
scoped.use('/requests', requireModule('ordering'), requestsRouter);
scoped.post('/sse-token', requireModule('ordering'), orderingController.sseToken);
scoped.use('/', restaurantsRouter);

adminRouter.use('/restaurants/:restaurantId', requireAuth, requireMembership(), scoped);
