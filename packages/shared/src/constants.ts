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

/* ------------------------------------------------------------------ table ordering (Phase 6) */

/** off = view-only menu (default) · call_waiter = "Call the waiter" / "The bill" buttons only · order = guests send orders. */
export const ORDERING_MODES = ['off', 'call_waiter', 'order'] as const;
export type OrderingMode = (typeof ORDERING_MODES)[number];

/**
 * Order lifecycle: new → accepted → delivered, or rejected (staff, with a reason), cancelled (guest, while new),
 * expired (nobody picked it up within ORDERING_LIMITS.expiryMinutes). See `canTransitionOrder()`.
 */
export const ORDER_STATUSES = ['new', 'accepted', 'delivered', 'rejected', 'cancelled', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SERVICE_REQUEST_TYPES = ['call_waiter', 'bill'] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = ['open', 'done'] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

/** Server-Sent Events emitted on GET /api/admin/restaurants/:id/events. */
export const ORDERING_EVENT_TYPES = ['order.created', 'order.updated', 'request.created', 'request.updated', 'ping'] as const;
export type OrderingEventType = (typeof ORDERING_EVENT_TYPES)[number];

export const ORDERING_LIMITS = {
  /** Lines per order. */
  maxLines: 30,
  /** Quantity per line. */
  maxQuantity: 20,
  /** Open (new/accepted) orders one guest session may have at a time. */
  maxOpenOrdersPerSession: 3,
  orderNoteMax: 200,
  lineNoteMax: 80,
  guestNameMax: 40,
  pausedMessageMax: 120,
  rejectedReasonMax: 200,
  /** A `new` order nobody accepted within this many minutes expires automatically. */
  expiryMinutes: 20,
  /** "Block 30 min" in the CMS: how long a table stays blocked. */
  tableBlockMinutes: 30,
  /** Guest-side cooldown between two calls of the same kind (seconds). */
  callCooldownSeconds: 60,
  /** Lifetime of the token used to open the SSE stream (seconds). */
  sseTokenSeconds: 300,
} as const;

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
  orderingMode: 'off',
} as const satisfies {
  primaryColor: string;
  theme: Theme;
  currency: string;
  defaultLocale: Locale;
  supportedLocales: readonly Locale[];
  timezone: string;
  trialDays: number;
  orderingMode: OrderingMode;
};

/** Error codes returned in `{ error: { code } }`. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'MODULE_DISABLED',
  'PAYMENT_NOT_ALLOWED',
  'PAYMENT_PROVIDER_UNAVAILABLE',
  'PAYMENT_NOT_FOUND',
  'INVALID_SIGNATURE',
  'POS_UNAVAILABLE',
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
  // ordering
  'SESSION_REQUIRED',
  'ORDERING_DISABLED',
  'ORDERING_PAUSED',
  'TABLE_NOT_FOUND',
  'TABLE_BLOCKED',
  'TOO_MANY_OPEN_ORDERS',
  'ITEM_UNAVAILABLE',
  'INVALID_TRANSITION',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
