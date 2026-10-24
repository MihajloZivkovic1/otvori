import type { Request, Response } from 'express';
import { removePinSchema, setPinSchema, unlockSchema, updateSecuritySchema } from '@qr-menu/shared';
import { ELEVATION_HEADER, headerValue, restaurantIdOf } from '../../middleware/membership.js';
import { noStore } from '../../utils/http.js';
import * as service from './service.js';

export async function getSecurity(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await service.getSecurity(restaurantIdOf(req), req.user!));
}

export async function updateSecurity(req: Request, res: Response): Promise<void> {
  const input = updateSecuritySchema.parse(req.body);
  noStore(res);
  res.json(await service.updateSecurity(restaurantIdOf(req), req.user!, input));
}

export async function setPin(req: Request, res: Response): Promise<void> {
  const input = setPinSchema.parse(req.body);
  noStore(res);
  res.json(await service.setPin(restaurantIdOf(req), req.user!, input));
}

export async function removePin(req: Request, res: Response): Promise<void> {
  const input = removePinSchema.parse(req.body);
  noStore(res);
  res.json(await service.removePin(restaurantIdOf(req), req.user!, input));
}

export async function unlock(req: Request, res: Response): Promise<void> {
  const input = unlockSchema.parse(req.body);
  noStore(res);
  res.json(await service.unlock(restaurantIdOf(req), req.user!, input));
}

export function extend(req: Request, res: Response): void {
  noStore(res);
  res.json(service.extend(restaurantIdOf(req), req.user!, headerValue(req, ELEVATION_HEADER)));
}
