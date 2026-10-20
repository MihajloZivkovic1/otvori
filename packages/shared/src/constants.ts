/**
 * Domain constants shared by the API and both frontends.
 * Every enum-like value used in a request body or DB column is defined here once.
 */

export const ALLERGENS = ['G', 'M', 'E', 'N', 'S', 'F', 'C', 'Se'] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const TAGS = ['vegan', 'spicy', 'new'] as const;
export type Tag = (typeof TAGS)[number];

/** Locales the platform knows how to validate and resolve. */
export const LOCALES = ['sr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEMES = ['light', 'dark', 'auto'] as const;
export type Theme = (typeof THEMES)[number];

export const RESTAURANT_STATUSES = ['active', 'trial', 'suspended'] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const PLANS = ['trial', 'starter', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export const MEMBERSHIP_ROLES = ['owner', 'staff'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const AUTH_TOKEN_TYPES = ['magic_link', 'password_reset', 'refresh'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

export const ANALYTICS_RANGES = ['7d', '14d', '30d'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const ANALYTICS_RANGE_DAYS: Record<AnalyticsRange, number> = { '7d': 7, '14d': 14, '30d': 30 };

export const PUBLIC_EVENT_TYPES = ['scan', 'item_view'] as const;
export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

/** Named presets accepted by PATCH /items/:id/availability `until`. */
export const AVAILABILITY_UNTIL_PRESETS = ['tomorrow-06:00'] as const;
export type AvailabilityUntilPreset = (typeof AVAILABILITY_UNTIL_PRESETS)[number];

export const RESTAURANT_DEFAULTS = {
  primaryColor: '#7A3E48',
  theme: 'light',
  currency: 'RSD',
  defaultLocale: 'sr',
  supportedLocales: ['sr', 'en'],
  timezone: 'Europe/Belgrade',
  trialDays: 14,
} as const satisfies {
  primaryColor: string;
  theme: Theme;
  currency: string;
  defaultLocale: Locale;
  supportedLocales: readonly Locale[];
  timezone: string;
  trialDays: number;
};

/** Error codes returned in `{ error: { code } }`. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'PLAN_REQUIRED',
  'NOT_FOUND',
  'RESTAURANT_NOT_FOUND',
  'MENU_NOT_PUBLISHED',
  'CONFLICT',
  'EMAIL_TAKEN',
  'SLUG_TAKEN',
  'TABLE_NUMBER_TAKEN',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
