import { z } from 'zod';
import { ORDER_STATUSES, ORDERING_LIMITS, ORDERING_MODES, SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_TYPES } from '../constants.js';
import { STAFF_ORDER_STATUSES } from '../ordering.js';
import { isoDateTimeSchema, localeSchema, uuidSchema } from './common.js';

export const orderingModeSchema = z.enum(ORDERING_MODES);
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const serviceRequestTypeSchema = z.enum(SERVICE_REQUEST_TYPES);
export const serviceRequestStatusSchema = z.enum(SERVICE_REQUEST_STATUSES);

/** Table number as printed on the QR card; the inline cart field may send it as a string. */
export const tableNumberSchema = z.coerce.number().int().min(1).max(9999);

/** Free text where '' means "none" (the key stays optional in the parsed type). */
const optionalNote = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();

export const orderLineSchema = z.object({
  itemId: uuidSchema,
  /** Required when the item has variants, forbidden otherwise (checked by the API against the menu). */
  variantId: uuidSchema.nullish(),
  quantity: z.number().int().min(1).max(ORDERING_LIMITS.maxQuantity),
  note: optionalNote(ORDERING_LIMITS.lineNoteMax),
});
export type OrderLineInput = z.infer<typeof orderLineSchema>;

/** POST /api/public/:slug/orders (requires X-Session-Id). Prices and totals are computed by the API, never trusted. */
export const createOrderSchema = z.object({
  tableNumber: tableNumberSchema,
  items: z.array(orderLineSchema).min(1, 'Add at least one item').max(ORDERING_LIMITS.maxLines),
  note: optionalNote(ORDERING_LIMITS.orderNoteMax),
  guestName: optionalNote(ORDERING_LIMITS.guestNameMax),
  /** Locale the guest was reading the menu in; item names are snapshotted in it and the restaurant default. */
  locale: localeSchema.optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** POST /api/public/:slug/requests — "Call the waiter" / "The bill". */
export const createServiceRequestSchema = z.object({
  type: serviceRequestTypeSchema,
  tableNumber: tableNumberSchema,
});
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

const statusListSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value),
  z.array(orderStatusSchema).min(1),
);

/**
 * GET /admin/restaurants/:id/orders?status=new,accepted&since=<iso>
 * Without parameters: every open order plus everything created today (restaurant time zone).
 */
export const listOrdersQuerySchema = z.object({
  status: statusListSchema.optional(),
  since: isoDateTimeSchema.optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

/** PATCH /admin/restaurants/:id/orders/:orderId — accept, deliver or reject (with the reason the guest sees). */
export const updateOrderStatusSchema = z
  .object({
    status: z.enum(STAFF_ORDER_STATUSES),
    rejectedReason: optionalNote(ORDERING_LIMITS.rejectedReasonMax),
  })
  .refine((d) => d.status === 'rejected' || d.rejectedReason === undefined, {
    message: 'rejectedReason is only allowed when rejecting',
    path: ['rejectedReason'],
  });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/** GET /admin/restaurants/:id/requests?status=open — without parameters: open ones plus today's. */
export const listServiceRequestsQuerySchema = z.object({
  status: serviceRequestStatusSchema.optional(),
  since: isoDateTimeSchema.optional(),
});
export type ListServiceRequestsQuery = z.infer<typeof listServiceRequestsQuerySchema>;

/** PATCH /admin/restaurants/:id/requests/:requestId */
export const updateServiceRequestSchema = z.object({ status: z.literal('done') });
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;
