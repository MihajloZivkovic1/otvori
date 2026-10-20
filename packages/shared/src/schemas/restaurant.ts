import { z } from 'zod';
import { LOCALES } from '../constants.js';
import {
  hexColorSchema,
  localeSchema,
  optionalTextSchema,
  slugSchema,
  themeSchema,
  timezoneSchema,
} from './common.js';

/** PATCH /admin/restaurants/:restaurantId — settings + branding (owner only). */
export const updateRestaurantSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: slugSchema,
    tagline: optionalTextSchema(160),
    menuNote: optionalTextSchema(500),
    primaryColor: hexColorSchema,
    theme: themeSchema,
    currency: z.string().trim().min(1).max(8),
    defaultLocale: localeSchema,
    supportedLocales: z.array(localeSchema).min(1).max(LOCALES.length),
    timezone: timezoneSchema,
    address: optionalTextSchema(200),
    city: optionalTextSchema(100),
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
