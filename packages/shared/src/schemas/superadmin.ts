import { z } from 'zod';
import {
  ADMIN_LIMITS,
  MENU_IMPORT_LIMITS,
  ONBOARDING_STEP_COUNT,
  RESTAURANT_SORT_KEYS,
  SORT_DIRECTIONS,
  TABLE_BULK_LIMITS,
  USER_SORT_KEYS,
} from '../admin.js';
import { LOCALES } from '../constants.js';
import { MODULES, restaurantModulesSchema } from '../modules.js';
import { auditActionSchema, auditKindSchema } from './audit.js';
import {
  allergenSchema,
  emailSchema,
  hexColorSchema,
  isoDateTimeSchema,
  localeSchema,
  membershipRoleSchema,
  optionalTextSchema,
  passwordSchema,
  planSchema,
  priceCentsSchema,
  restaurantStatusSchema,
  slugSchema,
  tagSchema,
  timezoneSchema,
  translatedTextOrEmptySchema,
  translatedTextSchema,
  uuidSchema,
} from './common.js';
import { orderingModeSchema } from './ordering.js';

const adminPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_LIMITS.maxPageSize).default(ADMIN_LIMITS.pageSize),
});

const boolQuery = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();

/** YYYY-MM-DD (a date without a time, for "paid until"). */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date like 2026-12-31');

/* ------------------------------------------------------------------ restaurants */

export const superadminListRestaurantsQuerySchema = adminPagination.extend({
  /** Name, slug, city or the owner's e-mail. */
  search: z.string().trim().max(100).optional(),
  status: restaurantStatusSchema.optional(),
  plan: planSchema.optional(),
  /** Only venues with this module on. */
  module: z.enum(MODULES).optional(),
  /** Only venues whose onboarding is not finished. */
  onboarding: boolQuery,
  sort: z.enum(RESTAURANT_SORT_KEYS).default('updatedAt'),
  dir: z.enum(SORT_DIRECTIONS).default('desc'),
});
export type SuperadminListRestaurantsQuery = z.infer<typeof superadminListRestaurantsQuerySchema>;

/** Venue fields a superadmin may set (the wizard's step 1 and the detail page). */
const venueFields = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  slug: slugSchema,
  city: optionalTextSchema(100),
  address: optionalTextSchema(200),
  timezone: timezoneSchema,
  currency: z.string().trim().min(1).max(8),
  defaultLocale: localeSchema,
  supportedLocales: z.array(localeSchema).min(1).max(LOCALES.length),
  tagline: optionalTextSchema(160),
  menuNote: optionalTextSchema(500),
  primaryColor: hexColorSchema,
  orderingMode: orderingModeSchema,
});

const localesConsistent = <T extends { defaultLocale?: string; supportedLocales?: string[] }>(d: T) =>
  !d.defaultLocale || !d.supportedLocales || d.supportedLocales.includes(d.defaultLocale);

/** POST /api/superadmin/restaurants — the wizard's step 1 (no owner yet). */
export const superadminCreateRestaurantSchema = venueFields
  .partial({ slug: true, city: true, address: true, timezone: true, currency: true, defaultLocale: true, supportedLocales: true, tagline: true, menuNote: true, primaryColor: true, orderingMode: true })
  .refine(localesConsistent, { message: 'supportedLocales must include defaultLocale', path: ['supportedLocales'] });
export type SuperadminCreateRestaurantInput = z.infer<typeof superadminCreateRestaurantSchema>;

/** PATCH /api/superadmin/restaurants/:id — plan, modules, billing and every venue field. */
export const superadminUpdateRestaurantSchema = venueFields
  .extend({
    status: restaurantStatusSchema,
    plan: planSchema,
    trialEndsAt: isoDateTimeSchema.nullable(),
    /** Any module; partial = only the keys sent change. */
    modules: restaurantModulesSchema.partial(),
    /** Free text for manual invoicing ("pays yearly, invoice to …"). */
    billingNote: optionalTextSchema(2000),
    /** Until when the venue has paid (manual invoicing); null = nothing recorded. */
    paidUntil: isoDateSchema.nullable(),
    /** Internal notes about the venue (contact person, agreements). Never shown to the venue. */
    adminNotes: optionalTextSchema(4000),
    /** 1–4 = the wizard step to resume at; null = onboarding finished. */
    onboardingStep: z.number().int().min(1).max(ONBOARDING_STEP_COUNT).nullable(),
  })
  .partial()
  .refine(localesConsistent, { message: 'supportedLocales must include defaultLocale', path: ['supportedLocales'] });
export type SuperadminUpdateRestaurantInput = z.infer<typeof superadminUpdateRestaurantSchema>;

export const slugCheckQuerySchema = z.object({
  slug: z.string().trim().max(100),
  /** Ignore this venue's own slug (editing). */
  restaurantId: uuidSchema.optional(),
});
export type SlugCheckQuery = z.infer<typeof slugCheckQuerySchema>;

/* ------------------------------------------------------------------ members (wizard step 2 + detail → Members) */

const personName = z.string().trim().min(1, 'Name is required').max(100);
export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+\d][\d\s/().-]*$/, 'Enter a phone number like +381 60 123 4567');

/**
 * POST /api/superadmin/restaurants/:id/members — attach an existing account (by e-mail) or create one.
 * `password` and `name` are only used when the account does not exist yet.
 */
export const superadminAddMemberSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema.default('owner'),
  name: personName.optional(),
  password: passwordSchema.optional(),
  /** The person must set a new password on the first sign-in (the admin typed this one). */
  mustChangePassword: z.boolean().default(false),
  /** The admin's own contact for the person; shown only in the superadmin area. */
  phone: phoneSchema.nullable().optional(),
});
export type SuperadminAddMemberInput = z.infer<typeof superadminAddMemberSchema>;

export const superadminUpdateMemberSchema = z.object({ role: membershipRoleSchema });
export type SuperadminUpdateMemberInput = z.infer<typeof superadminUpdateMemberSchema>;

/** POST /api/superadmin/restaurants/:id/invites — an e-mail invite (resend = send again). */
export const superadminInviteSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema.default('staff'),
});
export type SuperadminInviteInput = z.infer<typeof superadminInviteSchema>;

/* ------------------------------------------------------------------ users */

export const superadminListUsersQuerySchema = adminPagination.extend({
  /** Name, e-mail or phone. */
  search: z.string().trim().max(100).optional(),
  superadmin: boolQuery,
  deactivated: boolQuery,
  sort: z.enum(USER_SORT_KEYS).default('createdAt'),
  dir: z.enum(SORT_DIRECTIONS).default('desc'),
});
export type SuperadminListUsersQuery = z.infer<typeof superadminListUsersQuerySchema>;

export const superadminUpdateUserSchema = z
  .object({
    name: personName,
    phone: phoneSchema.nullable(),
    isSuperadmin: z.boolean(),
    mustChangePassword: z.boolean(),
  })
  .partial();
export type SuperadminUpdateUserInput = z.infer<typeof superadminUpdateUserSchema>;

/** POST …/users/:id/password — the admin sets a password directly (optionally forcing a change on first sign-in). */
export const superadminSetPasswordSchema = z.object({
  password: passwordSchema,
  mustChangePassword: z.boolean().default(true),
});
export type SuperadminSetPasswordInput = z.infer<typeof superadminSetPasswordSchema>;

/* ------------------------------------------------------------------ activity (global audit log) */

export const superadminActivityQuerySchema = adminPagination.extend({
  restaurantId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  kind: auditKindSchema.default('all'),
  action: auditActionSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type SuperadminActivityQuery = z.infer<typeof superadminActivityQuerySchema>;

/* ------------------------------------------------------------------ onboarding: tables, menu import, copy, welcome mail */

/** POST /api/admin/restaurants/:id/tables/bulk — "Sto 1" … "Sto N" (numbers continue after the highest existing). */
export const bulkTablesSchema = z.object({
  count: z.number().int().min(1).max(TABLE_BULK_LIMITS.maxCount),
  prefix: z.string().trim().min(1).max(30).default(TABLE_BULK_LIMITS.defaultPrefix),
  /** First table number; default = the highest existing number + 1. */
  startAt: z.number().int().min(1).max(9999).optional(),
});
export type BulkTablesInput = z.infer<typeof bulkTablesSchema>;

/** One row of the spreadsheet after the preview; what POST …/menu/import takes back. */
export const menuImportRowSchema = z.object({
  category: z.string().trim().min(1, 'Category is required').max(100),
  name: translatedTextSchema,
  description: translatedTextOrEmptySchema.nullable(),
  priceCents: priceCentsSchema,
  allergens: z.array(allergenSchema).max(20),
  tags: z.array(tagSchema).max(10),
});
export type MenuImportRow = z.infer<typeof menuImportRowSchema>;

export const menuImportSchema = z.object({
  rows: z.array(menuImportRowSchema).min(1, 'Nothing to import').max(MENU_IMPORT_LIMITS.maxRows),
  /** What to do with categories that already exist by name: add the items to them (default) or skip those rows. */
  existing: z.enum(['merge', 'skip']).default('merge'),
});
export type MenuImportInput = z.infer<typeof menuImportSchema>;

/** POST /api/superadmin/restaurants/:id/menu/copy */
export const copyMenuSchema = z.object({
  sourceRestaurantId: uuidSchema,
});
export type CopyMenuInput = z.infer<typeof copyMenuSchema>;

/** POST /api/superadmin/restaurants/:id/welcome-email */
export const welcomeEmailSchema = z.object({
  /** The owner to write to; default = the first owner. */
  userId: uuidSchema.optional(),
  /** Put the password the admin set into the mail (it is never stored, so the client has to send it). */
  password: passwordSchema.optional(),
  /** Extra sentence from the admin, appended before the steps. */
  note: optionalTextSchema(500).optional(),
});
export type WelcomeEmailInput = z.infer<typeof welcomeEmailSchema>;

/* ------------------------------------------------------------------ global search (⌘K) */

export const superadminSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});
export type SuperadminSearchQuery = z.infer<typeof superadminSearchQuerySchema>;
