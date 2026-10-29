/**
 * Superadmin area and venue onboarding (Phase 13). Numbers the API, the CMS and the tests agree on.
 */

export const IMPERSONATION_LIMITS = {
  /** Lifetime of one "Open as owner" token (minutes). The CMS asks for a new one when it expires. */
  ttlMinutes: 60,
} as const;

export const ADMIN_LIMITS = {
  /** Rows per page on the superadmin lists. */
  pageSize: 50,
  maxPageSize: 200,
  /** Results per group in the global search (⌘K). */
  searchLimit: 5,
} as const;

/** Sortable columns of the superadmin restaurant list. */
export const RESTAURANT_SORT_KEYS = ['name', 'status', 'plan', 'trialEndsAt', 'tables', 'items', 'owner', 'updatedAt', 'lastScanAt', 'createdAt'] as const;
export type RestaurantSortKey = (typeof RESTAURANT_SORT_KEYS)[number];

export const USER_SORT_KEYS = ['name', 'email', 'lastLoginAt', 'createdAt'] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * The onboarding wizard (/admin/restaurants/new): each step is saved, `restaurants.onboarding_step` remembers the
 * next one to show (null = finished), so a venue can be set up over several sittings.
 */
export const ONBOARDING_STEPS = ['venue', 'owner', 'plan', 'setup'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export const TABLE_BULK_LIMITS = {
  maxCount: 500,
  /** Default label prefix: "Sto 1", "Sto 2", … */
  defaultPrefix: 'Sto',
} as const;

/** Columns of the menu spreadsheet template (CSV / XLSX), in order. Header names are matched case-insensitively. */
export const MENU_IMPORT_COLUMNS = [
  'category',
  'name_sr',
  'name_en',
  'description_sr',
  'description_en',
  'price',
  'allergens',
  'tags',
] as const;
export type MenuImportColumn = (typeof MENU_IMPORT_COLUMNS)[number];

export const MENU_IMPORT_LIMITS = {
  maxRows: 1000,
  maxFileBytes: 2 * 1024 * 1024,
} as const;

/** Where a generated owner password is accepted from: letters, digits, no look-alikes (0/O, 1/l/I). */
export const PASSWORD_GENERATOR = {
  length: 12,
  alphabet: 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;

/** One suggestion per step of the welcome e-mail (Serbian), so the CMS can preview what the owner receives. */
export const WELCOME_STEPS_SR = [
  'Prijavi se i prođi kroz meni — proveri nazive, cene i opise.',
  'Odštampaj QR kodove: Stolovi → „QR tabla (PDF)“.',
  'Objavi meni dugmetom „Publish“ gore desno — od tog trenutka gosti ga vide.',
] as const;
