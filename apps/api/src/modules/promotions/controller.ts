import type { Request, Response } from 'express';
import { createPromotionSchema, publicMenuQuerySchema, togglePromotionSchema, updatePromotionSchema } from '@qr-menu/shared';
import { restaurantIdOf } from '../../middleware/membership.js';
import { uploadedFile } from '../../middleware/upload.js';
import { noStore, uuidParam } from '../../utils/http.js';
import { slugOf } from '../public/controller.js';
import * as service from './service.js';

const promoId = (req: Request) => uuidParam(req.params.promoId, 'promoId');

export async function listPromotions(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.listPromotions(restaurantIdOf(req)));
}

export async function createPromotion(req: Request, res: Response): Promise<void> {
  const input = createPromotionSchema.parse(req.body);
  res.status(201).json(await service.createPromotion(restaurantIdOf(req), input));
}

export async function getPromotion(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getPromotion(restaurantIdOf(req), promoId(req)));
}

export async function updatePromotion(req: Request, res: Response): Promise<void> {
  const input = updatePromotionSchema.parse(req.body);
  res.json(await service.updatePromotion(restaurantIdOf(req), promoId(req), input));
}

export async function togglePromotion(req: Request, res: Response): Promise<void> {
  const input = togglePromotionSchema.parse(req.body);
  res.json(await service.togglePromotion(restaurantIdOf(req), promoId(req), input));
}

export async function deletePromotion(req: Request, res: Response): Promise<void> {
  await service.deletePromotion(restaurantIdOf(req), promoId(req));
  res.status(204).end();
}

export async function uploadImage(req: Request, res: Response): Promise<void> {
  const file = uploadedFile(req);
  res.json(await service.uploadPromotionImage(restaurantIdOf(req), promoId(req), file.buffer));
}

/** GET /api/public/r/:slug/promotions (also /:slug/promotions and the host-based /promotions). */
export async function getPublicPromotions(req: Request, res: Response): Promise<void> {
  const { locale } = publicMenuQuerySchema.parse(req.query);
  const promotions = await service.listPublicPromotions(slugOf(req), locale);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('Vary', 'Accept-Encoding');
  res.json(promotions);
}
