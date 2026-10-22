import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { signSseToken } from '../../utils/jwt.js';
import { slugOf } from '../public/controller.js';
import {
  createOrderSchema,
  createServiceRequestSchema,
  listOrdersQuerySchema,
  listServiceRequestsQuerySchema,
  updateOrderStatusSchema,
  updateServiceRequestSchema,
} from './schemas.js';
import * as service from './service.js';

/* ------------------------------------------------------------------ guest (/api/public/:slug/…, X-Session-Id) */

export async function createOrder(req: Request, res: Response): Promise<void> {
  const input = createOrderSchema.parse(req.body);
  const order = await service.createOrder(slugOf(req), req.sessionId!, input);
  noStore(res);
  res.status(201).json(order);
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getPublicOrder(slugOf(req), req.sessionId!, uuidParam(req.params.id)));
}

export async function cancelOrder(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.cancelOrder(slugOf(req), req.sessionId!, uuidParam(req.params.id)));
}

export async function createServiceRequest(req: Request, res: Response): Promise<void> {
  const input = createServiceRequestSchema.parse(req.body);
  const { request, created } = await service.createServiceRequest(slugOf(req), input);
  noStore(res);
  res.status(created ? 201 : 200).json(request);
}

/* ------------------------------------------------------------------ staff (/api/admin/restaurants/:restaurantId/…) */

export async function listOrders(req: Request, res: Response): Promise<void> {
  const query = listOrdersQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.listOrders(restaurantIdOf(req), query));
}

export async function getStaffOrder(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getOrder(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const input = updateOrderStatusSchema.parse(req.body);
  res.json(await service.setOrderStatus(restaurantIdOf(req), uuidParam(req.params.id), input));
}

export async function listServiceRequests(req: Request, res: Response): Promise<void> {
  const query = listServiceRequestsQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.listServiceRequests(restaurantIdOf(req), query));
}

export async function completeServiceRequest(req: Request, res: Response): Promise<void> {
  updateServiceRequestSchema.parse(req.body);
  res.json(await service.completeServiceRequest(restaurantIdOf(req), uuidParam(req.params.id)));
}

/** A 5-minute token for GET /events (EventSource cannot send the bearer header). */
export function sseToken(req: Request, res: Response): void {
  noStore(res);
  res.json(signSseToken(req.user!.id, restaurantIdOf(req)));
}
