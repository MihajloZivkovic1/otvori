import { z } from 'zod';
import { LOCALES, ORDERING_LIMITS } from '../constants.js';
import {
  hexColorSchema,
  lightHexColorSchema,
  localeSchema,
  optionalTextSchema,
  slugSchema,
  themeSchema,
  timezoneSchema,
} from './common.js';
import { orderingModeSchema } from './ordering.js';

/** PATCH /admin/restaurants/:restaurantId — settings + branding (owner only). */
export const updateRestaurantSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slugSchema,
    tagline: optionalTextSchema(160),
    menuNote: optionalTextSchema(500),
    primaryColor: hexColorSchema,
    backgroundColor: lightHexColorSchema,
    theme: themeSchema,
    currency: z.string().trim().min(1).max(8),
    defaultLocale: localeSchema,
    supportedLocales: z.array(localeSchema).min(1).max(LOCALES.length),
    timezone: timezoneSchema,
    address: optionalTextSchema(200),
    city: optionalTextSchema(100),
    /** Table ordering (Phase 6): off | call_waiter | order, plus the pause switch and its guest-facing message. */
    orderingMode: orderingModeSchema,
    orderingPaused: z.boolean(),
    pausedMessage: optionalTextSchema(ORDERING_LIMITS.pausedMessageMax),
    /** Owners may only switch `ordering`; `payments` / `pos` need a contract and go through /api/superadmin (strict → 400). */
    modules: z.object({ ordering: z.boolean() }).strict().partial(),
  })
  .partial()
  .refine(
    (d) => !d.defaultLocale || !d.supportedLocales || d.supportedLocales.includes(d.defaultLocale),
    { message: 'supportedLocales must include defaultLocale', path: ['supportedLocales'] },
  );
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

/** POST /admin/restaurants — another venue for the signed-in user (owner membership, slug derived from the name). */
export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2, 'Restaurant name is required').max(100),
});
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
