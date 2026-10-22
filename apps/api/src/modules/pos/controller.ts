import type { Request, Response } from 'express';
import { applyPosSyncSchema, receiptEmailSchema, updatePosConfigSchema } from '@qr-menu/shared';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { slugOf } from '../public/controller.js';
import * as service from './service.js';

export async function getPosConfig(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getPosConfig(restaurantIdOf(req)));
}

export async function updatePosConfig(req: Request, res: Response): Promise<void> {
  const input = updatePosConfigSchema.parse(req.body);
  res.json(await service.updatePosConfig(restaurantIdOf(req), input));
}

export async function testPosConnection(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.testPosConnection(restaurantIdOf(req)));
}

export async function previewSync(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.previewPosSync(restaurantIdOf(req)));
}

export async function applySync(req: Request, res: Response): Promise<void> {
  const input = applyPosSyncSchema.parse(req.body);
  res.json(await service.applyPosSync(restaurantIdOf(req), input));
}

export async function retryFiscal(req: Request, res: Response): Promise<void> {
  res.json(await service.retryPosJobs(restaurantIdOf(req), uuidParam(req.params.id)));
}

export async function fiscalManual(req: Request, res: Response): Promise<void> {
  res.json(await service.markFiscalManual(restaurantIdOf(req), uuidParam(req.params.id)));
}

/* ------------------------------------------------------------------ guest */

export async function emailReceipt(req: Request, res: Response): Promise<void> {
  const { email } = receiptEmailSchema.parse(req.body);
  await service.emailReceipt(slugOf(req), req.sessionId!, uuidParam(req.params.id), email);
  noStore(res);
  res.status(202).json({ ok: true });
}
