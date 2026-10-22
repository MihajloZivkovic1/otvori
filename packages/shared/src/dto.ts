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
import {
  orderStatusSchema,
  orderingModeSchema,
  serviceRequestStatusSchema,
  serviceRequestTypeSchema,
} from './schemas/ordering.js';
import { restaurantModulesSchema } from './modules.js';
import { FISCAL_STATUSES, PAYMENT_ATTEMPT_STATUSES, PAYMENT_PROVIDERS, PAYMENT_STATUSES } from './payments.js';

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
  city: z.string().nullable(),
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

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentAttemptStatusSchema = z.enum(PAYMENT_ATTEMPT_STATUSES);
export const fiscalStatusSchema = z.enum(FISCAL_STATUSES);

export const paymentConfigDtoSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS).nullable(),
  merchantId: z.string().nullable(),
  hasSecret: z.boolean(),
  /** Tip percentages offered to the guest (0 = "no tip" is always first). */
  tipPresets: z.array(z.number().int()),
  receiptEmailEnabled: z.boolean(),
  /** True when the venue runs on the mock provider and PAYMENTS_MOCK is on: payments go through the simulator. */
  simulator: z.boolean(),
});
export type PaymentConfigDto = z.infer<typeof paymentConfigDtoSchema>;

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
  /** Feature modules (Phase 9b). `orderingMode` below is the setting; it only takes effect while `modules.ordering`. */
  modules: restaurantModulesSchema,
  /** Online payment set-up (Phase 9c); the merchant secret never leaves the API (`hasSecret`). */
  paymentConfig: paymentConfigDtoSchema,
  /** Table ordering: off (view-only), call_waiter (call/bill buttons) or order (guests send orders). */
  orderingMode: orderingModeSchema,
  /** When true the public menu hides "+"/cart and shows `pausedMessage`; calls still work. */
  orderingPaused: z.boolean(),
  pausedMessage: z.string().nullable(),
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
  /** 160×160 WebP for rows; null for photos uploaded before thumbnails existed. */
  thumbnailUrl: z.string().nullable(),
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
  /** While set (and in the future) guests at this table get 423 TABLE_BLOCKED on orders and calls. */
  blockedUntil: isoString.nullable(),
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
  /** Table ordering for the same two periods (guest-cancelled orders are left out of every number); null while the
   *  ordering module is off. */
  ordering: z.object({
    /** Orders received. */
    orders: analyticsMetricSchema,
    /** Share of orders that were accepted (accepted or delivered), in percent. */
    acceptedRate: analyticsMetricSchema,
    /** Median seconds from "sent" to "accepted"; null when nothing was accepted. */
    medianAcceptSeconds: z.number().nullable(),
    previousMedianAcceptSeconds: z.number().nullable(),
    /** Sum of accepted + delivered orders — guests pay the waiter, so this is "ordered", not "paid". */
    orderedRevenueCents: analyticsMetricSchema,
    /** Online payments (Phase 9c): count, amount without tips, and the tips. */
    paidOnlineCount: analyticsMetricSchema,
    paidOnlineCents: analyticsMetricSchema,
    tipsCents: analyticsMetricSchema,
  }).nullable(),
});
export type AnalyticsDto = z.infer<typeof analyticsDtoSchema>;

export const publicMenuItemDtoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  imageUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
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
    /** Which modules the venue has; the guest app gates its features on these too. */
    modules: restaurantModulesSchema,
    /** Effective mode: already `off` while `modules.ordering` is false. */
    orderingMode: orderingModeSchema,
    orderingPaused: z.boolean(),
    pausedMessage: z.string().nullable(),
  }),
  /** Locale the texts were resolved to. */
  locale: z.string(),
  categories: z.array(publicMenuCategoryDtoSchema),
  updatedAt: isoString,
});
export type PublicMenuDto = z.infer<typeof publicMenuDtoSchema>;

/* ------------------------------------------------------------------ table ordering */

export const orderItemDtoSchema = z.object({
  id: uuidSchema,
  /** Null once the menu item was deleted; the snapshot below still describes what was ordered. */
  menuItemId: uuidSchema.nullable(),
  variantId: uuidSchema.nullable(),
  /** Name snapshot in the guest's locale and the restaurant default locale. */
  name: translatedTextSchema,
  variantName: z.string().nullable(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  lineTotalCents: z.number().int(),
  lineNote: z.string().nullable(),
});
export type OrderItemDto = z.infer<typeof orderItemDtoSchema>;

/** Staff view of an order (admin endpoints and SSE events). */
export const orderDtoSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  /** Daily sequential number per restaurant, shown as "#142". */
  number: z.number().int(),
  status: orderStatusSchema,
  tableId: uuidSchema.nullable(),
  tableNumber: z.number().int(),
  guestName: z.string().nullable(),
  note: z.string().nullable(),
  totalCents: z.number().int(),
  locale: z.string(),
  rejectedReason: z.string().nullable(),
  items: z.array(orderItemDtoSchema),
  createdAt: isoString,
  updatedAt: isoString,
  acceptedAt: isoString.nullable(),
  deliveredAt: isoString.nullable(),
  closedAt: isoString.nullable(),
  /** While `new`: when the order expires unless somebody accepts it. */
  expiresAt: isoString.nullable(),
  /** Online payment (Phase 9c). `paidAmountCents` includes the tip; `providerRef` is the latest attempt. */
  paymentStatus: paymentStatusSchema,
  tipCents: z.number().int(),
  paidAmountCents: z.number().int().nullable(),
  paidAt: isoString.nullable(),
  providerRef: z.string().nullable(),
  /** Fiscal receipt (Phase 9d). */
  fiscalStatus: fiscalStatusSchema,
  fiscalInvoiceNumber: z.string().nullable(),
  fiscalVerificationUrl: z.string().nullable(),
  fiscalError: z.string().nullable(),
  posRef: z.string().nullable(),
});
export type OrderDto = z.infer<typeof orderDtoSchema>;

export const publicOrderItemDtoSchema = z.object({
  id: uuidSchema,
  /** Null once the menu item / variant was deleted; otherwise lets the guest "order again". */
  menuItemId: uuidSchema.nullable(),
  variantId: uuidSchema.nullable(),
  name: z.string(),
  variantName: z.string().nullable(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  lineTotalCents: z.number().int(),
  lineNote: z.string().nullable(),
});
export type PublicOrderItemDto = z.infer<typeof publicOrderItemDtoSchema>;

/** Guest view of their own order (GET /api/public/:slug/orders/:id with the matching X-Session-Id). */
export const publicOrderDtoSchema = z.object({
  id: uuidSchema,
  number: z.number().int(),
  status: orderStatusSchema,
  tableNumber: z.number().int(),
  guestName: z.string().nullable(),
  note: z.string().nullable(),
  totalCents: z.number().int(),
  currency: z.string(),
  locale: z.string(),
  rejectedReason: z.string().nullable(),
  items: z.array(publicOrderItemDtoSchema),
  createdAt: isoString,
  acceptedAt: isoString.nullable(),
  deliveredAt: isoString.nullable(),
  closedAt: isoString.nullable(),
  expiresAt: isoString.nullable(),
  paymentStatus: paymentStatusSchema,
  tipCents: z.number().int(),
  paidAmountCents: z.number().int().nullable(),
  paidAt: isoString.nullable(),
  /** Whether this venue offers online payment and which tip percentages it suggests. */
  payments: z.object({ enabled: z.boolean(), tipPresets: z.array(z.number().int()), receiptEmailEnabled: z.boolean() }),
  fiscalStatus: fiscalStatusSchema,
  fiscalInvoiceNumber: z.string().nullable(),
  fiscalVerificationUrl: z.string().nullable(),
});
export type PublicOrderDto = z.infer<typeof publicOrderDtoSchema>;

/** One payment attempt as the guest sees it (POST …/payments and GET …/payments/:ref). */
export const publicPaymentDtoSchema = z.object({
  ref: z.string(),
  status: paymentAttemptStatusSchema,
  /** Order total without the tip, the tip, and what the guest is asked to pay. */
  baseCents: z.number().int(),
  tipCents: z.number().int(),
  amountCents: z.number().int(),
  currency: z.string(),
  /** Text to encode as the QR (an IPS payment string, or the simulator URL on the mock provider). */
  qrPayload: z.string(),
  /** Opens the banking app directly when the provider supports it. */
  deepLink: z.string().nullable(),
  expiresAt: isoString,
  paidAt: isoString.nullable(),
});
export type PublicPaymentDto = z.infer<typeof publicPaymentDtoSchema>;

export const serviceRequestDtoSchema = z.object({
  id: uuidSchema,
  restaurantId: uuidSchema,
  tableId: uuidSchema,
  tableNumber: z.number().int(),
  type: serviceRequestTypeSchema,
  status: serviceRequestStatusSchema,
  createdAt: isoString,
  /** Bumped when the guest re-sends the same request while it is still open. */
  updatedAt: isoString,
  doneAt: isoString.nullable(),
});
export type ServiceRequestDto = z.infer<typeof serviceRequestDtoSchema>;

export const publicServiceRequestDtoSchema = z.object({
  id: uuidSchema,
  type: serviceRequestTypeSchema,
  status: serviceRequestStatusSchema,
  createdAt: isoString,
  updatedAt: isoString,
});
export type PublicServiceRequestDto = z.infer<typeof publicServiceRequestDtoSchema>;

/** POST /admin/restaurants/:id/sse-token — short-lived token passed as ?token= to the EventSource URL. */
export const sseTokenDtoSchema = z.object({
  token: z.string(),
  /** Seconds until the token expires. */
  expiresIn: z.number().int(),
});
export type SseTokenDto = z.infer<typeof sseTokenDtoSchema>;

/** Payload of every SSE message (`event:` carries the same `type`). */
export const orderingEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('order.created'), order: orderDtoSchema }),
  z.object({ type: z.literal('order.updated'), order: orderDtoSchema }),
  z.object({ type: z.literal('request.created'), request: serviceRequestDtoSchema }),
  z.object({ type: z.literal('request.updated'), request: serviceRequestDtoSchema }),
  z.object({ type: z.literal('ping'), at: isoString }),
]);
export type OrderingEvent = z.infer<typeof orderingEventSchema>;

export const superadminRestaurantDtoSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  status: restaurantStatusSchema,
  plan: planSchema,
  trialEndsAt: isoString.nullable(),
  publishedAt: isoString.nullable(),
  tableCount: z.number().int(),
  itemCount: z.number().int(),
  modules: restaurantModulesSchema,
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

/** GET /api/health — `ok` is false (HTTP 503) when the database ping fails; `version` is the build's git short SHA. */
export const healthDtoSchema = z.object({
  ok: z.boolean(),
  db: z.enum(['ok', 'error']),
  version: z.string(),
});
export type HealthDto = z.infer<typeof healthDtoSchema>;
