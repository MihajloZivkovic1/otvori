import type { NextFunction, Request, Response } from 'express';
import { hasModule, type ModuleKey } from '@qr-menu/shared';
import { Restaurant } from '../db/models/index.js';
import { AppError } from '../utils/errors.js';
import { restaurantIdOf } from './membership.js';

export const moduleDisabled = (module: ModuleKey) =>
  new AppError(403, 'MODULE_DISABLED', `The ${module} module is not enabled for this restaurant`, { module });

/**
 * Use after requireMembership() (or requireSseToken) on routes that belong to a module: a venue without the module
 * gets 403 MODULE_DISABLED, so the UI gate is never the only gate.
 */
export function requireModule(module: ModuleKey) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const restaurant = await Restaurant.findByPk(restaurantIdOf(req), { attributes: ['id', 'modules'] });
    if (!hasModule(restaurant, module)) throw moduleDisabled(module);
    next();
  };
}
