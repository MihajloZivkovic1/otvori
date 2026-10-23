import type { NextFunction, Request, Response } from 'express';
import { hasModule, type ModuleKey } from '@qr-menu/shared';
import { featureEnabled } from '../config/features.js';
import { Restaurant } from '../db/models/index.js';
import { AppError, notFound } from '../utils/errors.js';
import { restaurantIdOf } from './membership.js';

export const moduleDisabled = (module: ModuleKey) =>
  new AppError(403, 'MODULE_DISABLED', `The ${module} module is not enabled for this restaurant`, { module });

/**
 * Use after requireMembership() (or requireSseToken) on routes that belong to a module: a venue without the module
 * gets 403 MODULE_DISABLED, so the UI gate is never the only gate. A module whose global feature flag is off
 * (FEATURE_PAYMENTS / FEATURE_POS) does not exist in this deployment at all: plain 404, whatever the venue stored.
 */
export function requireModule(module: ModuleKey) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!featureEnabled(module)) throw notFound();
    const restaurant = await Restaurant.findByPk(restaurantIdOf(req), { attributes: ['id', 'modules'] });
    if (!hasModule(restaurant, module)) throw moduleDisabled(module);
    next();
  };
}

/** Route guard for endpoints that belong to a feature as a whole (webhooks, config): 404 while the flag is off. */
export function requireFeature(module: ModuleKey) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!featureEnabled(module)) throw notFound();
    next();
  };
}
