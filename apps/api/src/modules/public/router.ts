import { Router } from 'express';
import { hostSlug } from '../../middleware/host-slug.js';
import {
  publicEventsLimiter,
  publicOrdersLimiter,
  publicRequestsLimiter,
  sessionOrdersLimiter,
  sessionRequestsLimiter,
} from '../../middleware/rate-limit.js';
import { requireSession } from '../../middleware/session.js';
import * as ordering from '../ordering/controller.js';
import * as controller from './controller.js';

export const publicRouter = Router();

publicRouter.use(hostSlug);
// Host-based (kafeterija.otvori.menu/api/public/menu) and explicit (/api/public/kafeterija/menu) forms.
for (const prefix of ['', '/:slug']) {
  publicRouter.get(`${prefix}/menu`, controller.getMenu);
  publicRouter.post(`${prefix}/events`, publicEventsLimiter, controller.postEvent);
  // Table ordering: every route needs the guest session (X-Session-Id); writes are rate-limited per session and IP.
  publicRouter.post(`${prefix}/orders`, requireSession, sessionOrdersLimiter, publicOrdersLimiter, ordering.createOrder);
  publicRouter.get(`${prefix}/orders/:id`, requireSession, ordering.getOrder);
  publicRouter.post(`${prefix}/orders/:id/cancel`, requireSession, ordering.cancelOrder);
  publicRouter.post(`${prefix}/requests`, requireSession, sessionRequestsLimiter, publicRequestsLimiter, ordering.createServiceRequest);
}
