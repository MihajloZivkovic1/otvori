import type { Request, Response } from 'express';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore } from '../../utils/http.js';
import { analyticsQuerySchema } from './schemas.js';
import * as service from './service.js';

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const { range } = analyticsQuerySchema.parse(req.query);
  noStore(res);
  res.json(await service.getAnalytics(restaurantIdOf(req), range));
}
