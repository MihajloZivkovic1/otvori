import type { Request, Response } from 'express';
import type { OkDto } from '@qr-menu/shared';
import { notFound } from '../../utils/errors.js';
import { noStore } from '../../utils/http.js';
import { publicEventSchema, publicMenuQuerySchema, slugSchema } from './schemas.js';
import * as service from './service.js';

/** Slug from the route (/api/public/:slug/...) or from the Host subdomain (/api/public/...). */
export function slugOf(req: Request): string {
  const raw = req.params.slug ?? req.restaurantSlug;
  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return parsed.data;
}

export async function getMenu(req: Request, res: Response): Promise<void> {
  const { locale } = publicMenuQuerySchema.parse(req.query);
  const menu = await service.getPublicMenu(slugOf(req), locale);
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('Vary', 'Accept-Encoding');
  res.json(menu);
}

export async function postEvent(req: Request, res: Response): Promise<void> {
  const input = publicEventSchema.parse(req.body);
  await service.recordEvent(slugOf(req), input);
  noStore(res);
  const body: OkDto = { ok: true };
  res.status(202).json(body);
}
