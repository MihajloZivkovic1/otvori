import { z } from 'zod';
import type { OrderingMode } from './constants.js';

/**
 * Per-restaurant feature modules (Phase 9b). A venue with everything off is a plain QR menu — exactly the pre-Phase-6
 * app. `ordering` is the owner's own switch; `payments` and `pos` need contracts (bank gateway, POS vendor) and are
 * switched on by a superadmin after the paperwork, so owners only see "contact us".
 */
export const MODULES = ['ordering', 'payments', 'pos'] as const;
export type ModuleKey = (typeof MODULES)[number];

export const restaurantModulesSchema = z.object({
  ordering: z.boolean(),
  payments: z.boolean(),
  pos: z.boolean(),
});
export type RestaurantModules = z.infer<typeof restaurantModulesSchema>;

export const DEFAULT_MODULES: RestaurantModules = { ordering: false, payments: false, pos: false };

/** Modules an owner may toggle from Settings; the rest only through /api/superadmin. */
export const OWNER_TOGGLABLE_MODULES = ['ordering'] as const satisfies readonly ModuleKey[];

/** True when the module is switched on. Missing/partial objects (older payloads, fixtures) count as off. */
export function hasModule(
  restaurant: { modules?: Partial<RestaurantModules> | null } | null | undefined,
  module: ModuleKey,
): boolean {
  return restaurant?.modules?.[module] === true;
}

/** The `orderingMode` setting only counts while the ordering module is on; otherwise the venue is view-only. */
export function effectiveOrderingMode(restaurant: {
  modules?: Partial<RestaurantModules> | null;
  orderingMode: OrderingMode;
}): OrderingMode {
  return hasModule(restaurant, 'ordering') ? restaurant.orderingMode : 'off';
}
