import type { Request, Response } from 'express';
import { createPaymentSchema, markOrderPaymentSchema, updatePaymentConfigSchema } from '@qr-menu/shared';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { slugOf } from '../public/controller.js';
import * as service from './service.js';

/* ------------------------------------------------------------------ guest */

export async function createPayment(req: Request, res: Response): Promise<void> {
  const input = createPaymentSchema.parse(req.body ?? {});
  noStore(res);
  res.status(201).json(await service.createPayment(slugOf(req), req.sessionId!, uuidParam(req.params.id), input));
}

export async function getPayment(req: Request, res: Response): Promise<void> {
  const ref = String(req.params.ref ?? '');
  noStore(res);
  res.json(await service.getPaymentStatus(slugOf(req), req.sessionId!, uuidParam(req.params.id), ref));
}

/* ------------------------------------------------------------------ provider callbacks */

/** Verifies, answers 200 at once and applies the result afterwards (the gateway must never wait on our DB). */
export async function webhook(req: Request, res: Response): Promise<void> {
  const { apply } = await service.receiveWebhook(String(req.params.provider ?? ''), req);
  res.json({ received: true });
  setImmediate(() => service.trackBackground(apply()));
}

/* ------------------------------------------------------------------ staff */

export async function markOrderPayment(req: Request, res: Response): Promise<void> {
  markOrderPaymentSchema.parse(req.body);
  res.json(await service.markOrderCash(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function getPaymentConfig(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getPaymentConfig(restaurantIdOf(req)));
}

export async function updatePaymentConfig(req: Request, res: Response): Promise<void> {
  const input = updatePaymentConfigSchema.parse(req.body);
  res.json(await service.updatePaymentConfig(restaurantIdOf(req), input));
}

export async function testPaymentConnection(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.testPaymentConnection(restaurantIdOf(req)));
}
