import { z } from 'zod';
import { restaurantModulesSchema } from '../modules.js';
import { isoDateTimeSchema, paginationQuerySchema, planSchema, restaurantStatusSchema } from './common.js';

export const superadminListRestaurantsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: restaurantStatusSchema.optional(),
  plan: planSchema.optional(),
});
export type SuperadminListRestaurantsQuery = z.infer<typeof superadminListRestaurantsQuerySchema>;

export const superadminUpdateRestaurantSchema = z
  .object({
    status: restaurantStatusSchema,
    plan: planSchema,
    trialEndsAt: isoDateTimeSchema.nullable(),
    /** Any module; partial = only the keys sent change. */
    modules: restaurantModulesSchema.partial(),
  })
  .partial();
export type SuperadminUpdateRestaurantInput = z.infer<typeof superadminUpdateRestaurantSchema>;
