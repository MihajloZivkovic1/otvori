/**
 * Response DTOs. The API builds these shapes; the frontends type their fetch results with them.
 * All timestamps are ISO 8601 strings, all prices are integer minor units.
 */
import { z } from 'zod';
import { ERROR_CODES } from './constants.js';
import {
  allergenSchema,
  analyticsRangeSchema,
  localeSchema,
  membershipRoleSchema,
  planSchema,
  restaurantStatusSchema,
  tagSchema,
  themeSchema,
  translatedTextOrEmptySchema,
  translatedTextSchema,
  uuidSchema,
} from './schemas/common.js';

const isoString = z.string();

export const apiErrorDtoSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES).or(z.string()),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorDto = z.infer<typeof apiErrorDtoSchema>;

export const userDtoSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  name: z.string(),
  isSuperadmin: z.boolean(),
  hasPassword: z.boolean(),
  createdAt: isoString,
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const restaurantSummaryDtoSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  status: restaurantStatusSchema,
  plan: planSchema,
  publishedAt: isoString.nullable(),
});
export type RestaurantSummaryDto = z.infer<typeof restaurantSummaryDtoSchema>;

export const membershipDtoSchema = z.object({
  id: uuidSchema,
  role: membershipRoleSchema,
  restaurant: restaurantSummaryDtoSchema,
});
export type MembershipDto = z.infer<typeof membershipDtoSchema>;

export const meDtoSchema = z.object({
  user: userDtoSchema,
  memberships: z.array(membershipDtoSchema),
});
export type MeDto = z.infer<typeof meDtoSchema>;

export const authResponseDtoSchema = meDtoSchema.extend({
  accessToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number(),
});
export type AuthResponseDto = z.infer<typeof authResponseDtoSchema>;

export const okDtoSchema = z.object({ ok: z.literal(true) });
export type OkDto = z.infer<typeof okDtoSchema>;

export const restaurantDtoSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  menuNote: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  theme: themeSchema,
  currency: z.string(),
  defaultLocale: localeSchema.or(z.string()),
  supportedLocales: z.array(z.string()),
  timezone: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  status: restaurantStatusSchema,
  plan: planSchema,
  trialEndsAt: isoString.nullable(),
  publishedAt: isoString.nullable(),
  /** Public menu URL for this restaurant (no table). */
  publicUrl: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
});
export type RestaurantDto = z.infer<typeof restaurantDtoSchema>;

export const categoryDtoSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  name: translatedTextSchema,
  sortOrder: z.number().int(),
  isHidden: z.boolean(),
  itemCount: z.number().int(),
  createdAt: isoString,
  updatedAt: isoString,
});
export type CategoryDto = z.infer<typeof categoryDtoSchema>;

export const itemVariantDtoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  priceCents: z.number().int(),
  sortOrder: z.number().int(),
});
export type ItemVariantDto = z.infer<typeof itemVariantDtoSchema>;

export const menuItemDtoSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  categoryId: uuidSchema,
  name: translatedTextSchema,
  description: translatedTextOrEmptySchema.nullable(),
  priceCents: z.number().int(),
  imageUrl: z.string().nullable(),
  allergens: z.array(allergenSchema.or(z.string())),
  tags: z.array(tagSchema.or(z.string())),
  isAvailable: z.boolean(),
  unavailableUntil: isoString.nullable(),
  /** is_available AND (unavailable_until IS NULL OR unavailable_until < now()) */
  isEffectivelyAvailable: z.boolean(),
  sortOrder: z.number().int(),
  variants: z.array(itemVariantDtoSchema),
  createdAt: isoString,
  updatedAt: isoString,
});
export type MenuItemDto = z.infer<typeof menuItemDtoSchema>;

export const tableDtoSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  number: z.number().int(),
  label: z.string(),
  sortOrder: z.number().int(),
  /** Public menu URL encoded in this table's QR code. */
  menuUrl: z.string(),
  scansLast7Days: z.number().int(),
  lastScanAt: isoString.nullable(),
  createdAt: isoString,
});
export type TableDto = z.infer<typeof tableDtoSchema>;

export const analyticsMetricSchema = z.object({
  value: z.number(),
  previous: z.number(),
  /** Percent change vs the previous period; null when the previous period had no data. */
  deltaPct: z.number().nullable(),
});
export type AnalyticsMetric = z.infer<typeof analyticsMetricSchema>;

export const analyticsDtoSchema = z.object({
  range: analyticsRangeSchema,
  timezone: z.string(),
  period: z.object({ from: isoString, to: isoString }),
  previousPeriod: z.object({ from: isoString, to: isoString }),
  totalScans: analyticsMetricSchema,
  avgPerDay: analyticsMetricSchema,
  itemsViewedPerScan: analyticsMetricSchema,
  scansPerDay: z.array(z.object({ date: z.string(), scans: z.number().int() })),
  topItems: z.array(
    z.object({
      itemId: uuidSchema,
      name: translatedTextSchema,
      views: z.number().int(),
      previousViews: z.number().int(),
      deltaPct: z.number().nullable(),
    }),
  ),
  scansByTable: z.array(
    z.object({
      tableId: uuidSchema.nullable(),
      number: z.number().int().nullable(),
      label: z.string(),
      scans: z.number().int(),
      previousScans: z.number().int(),
      deltaPct: z.number().nullable(),
    }),
  ),
});
export type AnalyticsDto = z.infer<typeof analyticsDtoSchema>;

export const publicMenuItemDtoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  imageUrl: z.string().nullable(),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  isAvailable: z.boolean(),
  variants: z.array(z.object({ id: uuidSchema, name: z.string(), priceCents: z.number().int() })),
});
export type PublicMenuItemDto = z.infer<typeof publicMenuItemDtoSchema>;

export const publicMenuCategoryDtoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  items: z.array(publicMenuItemDtoSchema),
});
export type PublicMenuCategoryDto = z.infer<typeof publicMenuCategoryDtoSchema>;

export const publicMenuDtoSchema = z.object({
  restaurant: z.object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string().nullable(),
    menuNote: z.string().nullable(),
    logoUrl: z.string().nullable(),
    primaryColor: z.string(),
    theme: themeSchema,
    currency: z.string(),
    defaultLocale: z.string(),
    supportedLocales: z.array(z.string()),
    address: z.string().nullable(),
    city: z.string().nullable(),
  }),
  /** Locale the texts were resolved to. */
  locale: z.string(),
  categories: z.array(publicMenuCategoryDtoSchema),
  updatedAt: isoString,
});
export type PublicMenuDto = z.infer<typeof publicMenuDtoSchema>;

export const superadminRestaurantDtoSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  status: restaurantStatusSchema,
  plan: planSchema,
  trialEndsAt: isoString.nullable(),
  publishedAt: isoString.nullable(),
  tableCount: z.number().int(),
  itemCount: z.number().int(),
  owner: z.object({ id: uuidSchema, name: z.string(), email: z.string() }).nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});
export type SuperadminRestaurantDto = z.infer<typeof superadminRestaurantDtoSchema>;

export const paginatedDtoSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
export type PaginatedDto<T> = { items: T[]; total: number; page: number; pageSize: number };

export const healthDtoSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'error']),
  uptime: z.number(),
  version: z.string(),
});
export type HealthDto = z.infer<typeof healthDtoSchema>;
