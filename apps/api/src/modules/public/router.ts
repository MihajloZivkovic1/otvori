import { Router } from 'express';
import { hostSlug } from '../../middleware/host-slug.js';
import {
  publicEventsLimiter,
  publicOrdersLimiter,
  publicRequestsLimiter,
  sessionOrdersLimiter,
  sessionRequestsLimiter,
} from '../../middleware/rate-limit.js';
import { requireFeature } from '../../middleware/modules.js';
import { requireSession } from '../../middleware/session.js';
import * as ordering from '../ordering/controller.js';
import * as payments from '../payments/controller.js';
import * as pos from '../pos/controller.js';
import * as promotions from '../promotions/controller.js';
import * as controller from './controller.js';

export const publicRouter = Router();

publicRouter.use(hostSlug);
// Promotions (Phase 14): the active ones, cached like the menu. /r/:slug mirrors the menu app's path form.
publicRouter.get('/r/:slug/promotions', promotions.getPublicPromotions);
// Host-based (kafeterija.otvori.menu/api/public/menu) and explicit (/api/public/kafeterija/menu) forms.
for (const prefix of ['', '/:slug']) {
  publicRouter.get(`${prefix}/menu`, controller.getMenu);
  publicRouter.get(`${prefix}/promotions`, promotions.getPublicPromotions);
  publicRouter.post(`${prefix}/events`, publicEventsLimiter, controller.postEvent);
  // Table ordering: every route needs the guest session (X-Session-Id); writes are rate-limited per session and IP.
  publicRouter.post(`${prefix}/orders`, requireSession, sessionOrdersLimiter, publicOrdersLimiter, ordering.createOrder);
  publicRouter.get(`${prefix}/orders/:id`, requireSession, ordering.getOrder);
  publicRouter.post(`${prefix}/orders/:id/cancel`, requireSession, ordering.cancelOrder);
  // Online payment (Phase 9c): a payment attempt for an accepted order, and its status. 404 while FEATURE_PAYMENTS is off.
  publicRouter.post(`${prefix}/orders/:id/payments`, requireFeature('payments'), requireSession, sessionRequestsLimiter, publicRequestsLimiter, payments.createPayment);
  publicRouter.get(`${prefix}/orders/:id/payments/:ref`, requireFeature('payments'), requireSession, payments.getPayment);
  // Fiscal receipt by e-mail (Phase 9d).
  publicRouter.post(`${prefix}/orders/:id/receipt-email`, requireSession, sessionRequestsLimiter, publicRequestsLimiter, pos.emailReceipt);
  publicRouter.post(`${prefix}/requests`, requireSession, sessionRequestsLimiter, publicRequestsLimiter, ordering.createServiceRequest);
}
