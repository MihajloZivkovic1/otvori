import { Router } from 'express';
import * as controller from './controller.js';

/** /api/admin/restaurants/:restaurantId/orders — both roles (membership already verified). */
export const ordersRouter = Router({ mergeParams: true });
ordersRouter.get('/', controller.listOrders);
ordersRouter.get('/:id', controller.getStaffOrder);
ordersRouter.patch('/:id', controller.updateOrderStatus);

/** /api/admin/restaurants/:restaurantId/requests */
export const requestsRouter = Router({ mergeParams: true });
requestsRouter.get('/', controller.listServiceRequests);
requestsRouter.patch('/:id', controller.completeServiceRequest);
