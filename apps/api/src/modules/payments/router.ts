import { Router } from 'express';
import { requireOwner } from '../../middleware/membership.js';
import { requireModule } from '../../middleware/modules.js';
import * as controller from './controller.js';

/** POST /api/webhooks/payments/:provider — bank callbacks; each provider verifies its own signature. */
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post('/:provider', controller.webhook);

/** /api/admin/restaurants/:restaurantId/payment-config (owner) and …/orders/:id/payment (both roles). */
export const paymentConfigRouter = Router({ mergeParams: true });
paymentConfigRouter.use(requireModule('payments'));
paymentConfigRouter.get('/', controller.getPaymentConfig);
paymentConfigRouter.patch('/', requireOwner, controller.updatePaymentConfig);
paymentConfigRouter.post('/test', requireOwner, controller.testPaymentConnection);
