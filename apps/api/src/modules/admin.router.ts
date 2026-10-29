import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership } from '../middleware/membership.js';
import { requireModule } from '../middleware/modules.js';
import { analyticsRouter } from './analytics/router.js';
import { auditRouter } from './audit/router.js';
import { categoriesRouter } from './categories/router.js';
import { itemsRouter } from './items/router.js';
import { menuImportRouter } from './menu-import/router.js';
import * as orderingController from './ordering/controller.js';
import { ordersRouter, requestsRouter } from './ordering/router.js';
import * as paymentsController from './payments/controller.js';
import { paymentConfigRouter } from './payments/router.js';
import * as posController from './pos/controller.js';
import { promotionByIdRouter, promotionsRouter } from './promotions/router.js';
import { restaurantIdOfPromotion } from './promotions/service.js';
import { posConfigRouter, posRouter } from './pos/router.js';
import { requireSseToken, streamEvents } from './ordering/sse.js';
import * as restaurantsController from './restaurants/controller.js';
import { restaurantsRouter } from './restaurants/router.js';
import { securityRouter } from './security/router.js';
import { tablesRouter } from './tables/router.js';
import { uuidParam } from '../utils/http.js';
import { teamRouter } from './team/router.js';

/**
 * /api/admin/restaurants/:restaurantId/... — every route below is tenant-scoped by requireMembership.
 * Which routes are `service` (both roles) and which are `owner` (requireOwner: owner role + the PIN elevation when
 * the venue has one) is the matrix in docs/PERMISSIONS.md.
 */
export const adminRouter = Router();

// The one admin route without a :restaurantId: it creates the venue the caller will own.
adminRouter.post('/restaurants', requireAuth, restaurantsController.createRestaurant);

// Promotions by id (Phase 14): the venue comes from the promotion row, then the usual membership / owner checks apply.
adminRouter.use(
  '/promotions/:promoId',
  requireAuth,
  requireMembership({ restaurantId: (req) => restaurantIdOfPromotion(uuidParam(req.params.promoId, 'promoId')) }),
  promotionByIdRouter,
);

// Server-Sent Events for the waiter screen. EventSource cannot send a bearer header, so this route authenticates
// with the short-lived token from POST /sse-token (which does go through requireAuth + requireMembership).
adminRouter.get('/restaurants/:restaurantId/events', requireSseToken, requireModule('ordering'), streamEvents);

const scoped = Router({ mergeParams: true });
scoped.use('/categories', categoriesRouter);
scoped.use('/items', itemsRouter);
scoped.use('/tables', tablesRouter);
// Promotions (Phase 14): list/read for both roles, every change owner-level.
scoped.use('/promotions', promotionsRouter);
// Spreadsheet import (Phase 13b): template, preview with per-row errors, import.
scoped.use('/menu/import', menuImportRouter);
scoped.use('/analytics', analyticsRouter);
// Ordering module (Phase 9b): 403 MODULE_DISABLED for venues without it, whatever the UI shows.
scoped.use('/orders', requireModule('ordering'), ordersRouter);
scoped.use('/requests', requireModule('ordering'), requestsRouter);
scoped.post('/sse-token', requireModule('ordering'), orderingController.sseToken);
// Online payment (Phase 9c): the waiter marks cash; owners configure the provider.
scoped.patch('/orders/:id/payment', requireModule('ordering'), requireModule('payments'), paymentsController.markOrderPayment);
scoped.use('/payment-config', paymentConfigRouter);
// POS integration (Phase 9d): configuration, product sync and the fiscal retry on an order.
scoped.use('/pos-config', posConfigRouter);
scoped.use('/pos', posRouter);
scoped.post('/orders/:id/fiscal/retry', requireModule('ordering'), requireModule('pos'), posController.retryFiscal);
scoped.post('/orders/:id/fiscal/manual', requireModule('ordering'), requireModule('pos'), posController.fiscalManual);
// Owner PIN, team and the audit log (Phase 11).
scoped.use('/security', securityRouter);
scoped.use('/team', teamRouter);
scoped.use('/audit-log', auditRouter);
scoped.use('/', restaurantsRouter);

adminRouter.use('/restaurants/:restaurantId', requireAuth, requireMembership(), scoped);
