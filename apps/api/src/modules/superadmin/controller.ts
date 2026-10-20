import type { Request, Response } from 'express';
import { noStore, uuidParam } from '../../utils/http.js';
import { superadminListRestaurantsQuerySchema, superadminUpdateRestaurantSchema } from './schemas.js';
import * as service from './service.js';

export async function listRestaurants(req: Request, res: Response): Promise<void> {
  const query = superadminListRestaurantsQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.listRestaurants(query));
}

export async function updateRestaurant(req: Request, res: Response): Promise<void> {
  const input = superadminUpdateRestaurantSchema.parse(req.body);
  noStore(res);
  res.json(await service.updateRestaurant(uuidParam(req.params.id), input));
}
