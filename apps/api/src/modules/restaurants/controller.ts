import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { uploadedFile } from '../../middleware/upload.js';
import { noStore } from '../../utils/http.js';
import { createRestaurantSchema, updateRestaurantSchema } from './schemas.js';
import * as service from './service.js';

/** POST /api/admin/restaurants — not tenant-scoped: the caller becomes the owner of the new venue. */
export async function createRestaurant(req: Request, res: Response): Promise<void> {
  const input = createRestaurantSchema.parse(req.body);
  noStore(res);
  res.status(201).json(await service.createRestaurant(req.user!, input));
}

export async function getRestaurant(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getRestaurant(restaurantIdOf(req)));
}

export async function updateRestaurant(req: Request, res: Response): Promise<void> {
  const input = updateRestaurantSchema.parse(req.body);
  res.json(await service.updateRestaurant(restaurantIdOf(req), input));
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  const file = uploadedFile(req);
  res.json(await service.uploadLogo(restaurantIdOf(req), file.buffer));
}

export async function publishRestaurant(req: Request, res: Response): Promise<void> {
  res.json(await service.publishRestaurant(restaurantIdOf(req)));
}

export async function deleteRestaurant(req: Request, res: Response): Promise<void> {
  await service.deleteRestaurant(restaurantIdOf(req));
  res.status(204).end();
}
