import type { Request, Response } from 'express';
import { listAuditQuerySchema } from '@qr-menu/shared';
import { restaurantIdOf } from '../../middleware/membership.js';
import { noStore } from '../../utils/http.js';
import { listAuditLog } from './service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = listAuditQuerySchema.parse(req.query);
  noStore(res);
  res.json(await listAuditLog(restaurantIdOf(req), query));
}
