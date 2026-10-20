import { z } from 'zod';
import {
  ALLERGENS,
  ANALYTICS_RANGES,
  LOCALES,
  MEMBERSHIP_ROLES,
  PLANS,
  RESTAURANT_STATUSES,
  TAGS,
  THEMES,
} from '../constants.js';

export const uuidSchema = z.uuid({ message: 'Must be a UUID' });
export const localeSchema = z.enum(LOCALES);
export const themeSchema = z.enum(THEMES);
export const restaurantStatusSchema = z.enum(RESTAURANT_STATUSES);
export const planSchema = z.enum(PLANS);
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
export const allergenSchema = z.enum(ALLERGENS);
export const tagSchema = z.enum(TAGS);
export const analyticsRangeSchema = z.enum(ANALYTICS_RANGES);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Invalid email address' }).max(254));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #7A3E48');

/** DNS-safe label used as the public subdomain, e.g. `kafeterija` in kafeterija.salveta.menu. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Slug may contain lowercase letters, digits and hyphens');

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export const timezoneSchema = z.string().trim().min(1).refine(isValidTimeZone, 'Unknown IANA time zone');

export const isoDateTimeSchema = z.iso.datetime({ offset: true, message: 'Must be an ISO 8601 date-time' });

export const priceCentsSchema = z
  .number()
  .int('Price must be an integer in minor units')
  .min(0)
  .max(100_000_000);

export const sortOrderSchema = z.number().int().min(0).max(100_000);

const translationValueSchema = z.string().trim().max(500);
const longTranslationValueSchema = z.string().trim().max(2000);

/** `{ sr: '...', en: '...' }` with at least one non-empty translation. */
export const translatedTextSchema = z
  .partialRecord(localeSchema, translationValueSchema)
  .refine((value) => Object.values(value).some((v) => typeof v === 'string' && v.length > 0), {
    message: 'At least one translation is required',
  });

/** Same shape but every translation may be empty (used for optional descriptions). */
export const translatedTextOrEmptySchema = z.partialRecord(localeSchema, longTranslationValueSchema);

/** Nullable, optional free-text field where '' means "clear". */
export const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));

/** Accepts either `{ ids: [...] }` or a bare array of ids. */
export const reorderSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { ids: value } : value),
  z.object({ ids: z.array(uuidSchema).min(1).max(1000) }),
);
export type ReorderInput = z.infer<typeof reorderSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
