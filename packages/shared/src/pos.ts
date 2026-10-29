import { z } from 'zod';

/**
 * POS / fiscal integration with Octopos (Phase 9d, rebuilt on the real sandbox in Phase 12 — docs/octopos.md).
 * Two modes behind one `PosProvider`:
 *
 *   esir — Octopos fiscalises on behalf of the venue (no till): a paid order becomes one `POST /WebOrder` with the
 *          items, prices and payment type; Octopos talks to the tax authority and returns the fiscal receipt, which
 *          otvori renders as a PDF and mails to the guest. Production needs a Tax Authority certificate per venue and
 *          Octopos charges per issued receipt.
 *   pos  — the venue already runs an Octopos till: accepted orders open on the register's table, an online payment
 *          closes them with a fiscal receipt and the till prints. Not yet confirmed by Octopos for production
 *          (the sandbox supports it, see docs/octopos.md "POS mode").
 *
 * `mock` logs what it would send and returns fake receipts (POS_MOCK=true).
 */
export const POS_PROVIDERS = ['mock', 'octopos'] as const;
export type PosProviderKey = (typeof POS_PROVIDERS)[number];

export const POS_MODES = ['esir', 'pos'] as const;
export type PosMode = (typeof POS_MODES)[number];

/**
 * POS mode only — how an order that was opened on a table is closed after an online payment:
 *   reissue — cancel the open table order (`POST /WebOrder/{externalId}/Cancel`) and issue the receipt with a fresh
 *             `POST /WebOrder` carrying `FiscalPaymentTypeId` 6 (instant payment). Two calls, correct payment label.
 *   pay     — `POST /WebOrder/{billCumulativeId}/Pay`: one call, but the sandbox labels the receipt by the register's
 *             internal `PaymentTypeId` (2 = cash, 3 = card) and ignores the fiscal type; only usable once Octopos
 *             configures a payment type for instant payments on the venue's register (`payPaymentTypeId`).
 */
export const POS_CLOSE_STRATEGIES = ['reissue', 'pay'] as const;
export type PosCloseStrategy = (typeof POS_CLOSE_STRATEGIES)[number];

export const POS_JOB_TYPES = ['send_order', 'close_order'] as const;
export type PosJobType = (typeof POS_JOB_TYPES)[number];

export const POS_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type PosJobStatus = (typeof POS_JOB_STATUSES)[number];

/** Serbian production fiscal labels: Ђ = 20 % standard VAT, Е = 10 % reduced, Г / А = exempt. */
export const DEFAULT_TAX_LABEL = 'Ђ';

export const POS_LIMITS = {
  /** Retry delays in seconds after the 1st, 2nd, … failure; after the last one the job is `failed`. */
  retryDelaysSeconds: [30, 120, 600, 1800, 7200] as readonly number[],
  /** How often the queue is polled. */
  pollMs: 10_000,
  baseUrlMax: 200,
  apiKeyMax: 1000,
  productCodeMax: 64,
  tableNameMax: 64,
  taxLabelMax: 4,
  taxNumberMax: 20,
  /** Octopos: textual receipt width (32–60). */
  receiptLineWidth: 40,
} as const;

/** ExternalId prefix: `otvori-<orderId>` in production, `otvori-dev-<orderId>` against the shared sandbox. */
export function posExternalId(orderId: string, dev: boolean): string {
  return `${dev ? 'otvori-dev-' : 'otvori-'}${orderId}`;
}

/** POS mode, `reissue`: the receipt that replaces a cancelled table order needs its own ExternalId. */
export function posReceiptExternalId(orderId: string, dev: boolean): string {
  return `${posExternalId(orderId, dev)}-r`;
}

export const posConfigDtoSchema = z.object({
  provider: z.enum(POS_PROVIDERS).nullable(),
  mode: z.enum(POS_MODES),
  baseUrl: z.string().nullable(),
  hasApiKey: z.boolean(),
  /** Fiscal tax label sent when the register has to create a product (ESIR mode: every item). */
  taxLabel: z.string(),
  /** The venue's PIB, printed in the PDF header (the fiscal text itself carries the PFR's registered data). */
  taxNumber: z.string().nullable(),
  /** POS mode: our table id → the register's table name (Octopos `TableName`). */
  tableMapping: z.record(z.string(), z.string()),
  /** POS mode: accepted orders open on the register's table. */
  sendOrdersToPos: z.boolean(),
  /** Issue the fiscal receipt when the guest pays online (and, in ESIR mode, when staff mark the order as cash). */
  closeOnPayment: z.boolean(),
  closeStrategy: z.enum(POS_CLOSE_STRATEGIES),
  /** Octopos internal payment type id used with `closeStrategy: 'pay'`. */
  payPaymentTypeId: z.number().int().nullable(),
  /** True when the venue runs on the mock POS and POS_MOCK is on. */
  simulator: z.boolean(),
});
export type PosConfigDto = z.infer<typeof posConfigDtoSchema>;

/** PATCH /admin/restaurants/:id/pos-config (owner, pos module on); `apiKey` is write-only. */
export const updatePosConfigSchema = z
  .object({
    provider: z.enum(POS_PROVIDERS),
    mode: z.enum(POS_MODES),
    baseUrl: z.url().max(POS_LIMITS.baseUrlMax).nullable(),
    apiKey: z.string().trim().min(1).max(POS_LIMITS.apiKeyMax),
    taxLabel: z.string().trim().min(1).max(POS_LIMITS.taxLabelMax),
    taxNumber: z.string().trim().max(POS_LIMITS.taxNumberMax).nullable(),
    tableMapping: z.record(z.string().uuid(), z.string().trim().max(POS_LIMITS.tableNameMax)),
    sendOrdersToPos: z.boolean(),
    closeOnPayment: z.boolean(),
    closeStrategy: z.enum(POS_CLOSE_STRATEGIES),
    payPaymentTypeId: z.number().int().positive().nullable(),
  })
  .partial();
export type UpdatePosConfigInput = z.infer<typeof updatePosConfigSchema>;

/** A product as the POS reports it (normalised across providers). */
export const posProductSchema = z.object({
  code: z.string(),
  name: z.string(),
  group: z.string().nullable(),
  priceCents: z.number().int(),
  taxLabel: z.string().nullable(),
  active: z.boolean(),
});
export type PosProduct = z.infer<typeof posProductSchema>;

/** GET /admin/restaurants/:id/pos/tables — the register's active tables (POS mode table mapping). */
export const posTableDtoSchema = z.object({ id: z.number().int(), name: z.string() });
export type PosTableDto = z.infer<typeof posTableDtoSchema>;

/** GET /admin/restaurants/:id/pos/taxes — the fiscal labels the venue's PFR accepts. */
export const posTaxLabelDtoSchema = z.object({ label: z.string(), name: z.string(), percent: z.number() });
export type PosTaxLabelDto = z.infer<typeof posTaxLabelDtoSchema>;

/** GET /admin/restaurants/:id/pos/products — the diff the owner reviews before applying. */
export const posSyncPreviewDtoSchema = z.object({
  fetchedAt: z.string(),
  /** Codes not yet in the menu: would become new items. */
  create: z.array(posProductSchema),
  /** Mapped items whose POS price differs from the menu price. */
  update: z.array(
    z.object({
      itemId: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      currentPriceCents: z.number().int(),
      priceCents: z.number().int(),
    }),
  ),
  /** Mapped items whose code the POS no longer reports (left untouched). */
  missing: z.array(z.object({ itemId: z.string().uuid(), code: z.string(), name: z.string() })),
  /** Menu items without a POS code (cannot be ordered while sendOrdersToPos is on). */
  unmapped: z.number().int(),
});
export type PosSyncPreviewDto = z.infer<typeof posSyncPreviewDtoSchema>;

/** POST /admin/restaurants/:id/pos/sync — which rows of the preview to apply. */
export const applyPosSyncSchema = z.object({
  createCodes: z.array(z.string().max(POS_LIMITS.productCodeMax)).max(500).default([]),
  updateCodes: z.array(z.string().max(POS_LIMITS.productCodeMax)).max(500).default([]),
  /** Category for new items; created ("From the register") when absent. */
  categoryId: z.string().uuid().optional(),
});
export type ApplyPosSyncInput = z.infer<typeof applyPosSyncSchema>;

export const posSyncResultDtoSchema = z.object({ created: z.number().int(), updated: z.number().int(), categoryId: z.string().uuid().nullable() });
export type PosSyncResultDto = z.infer<typeof posSyncResultDtoSchema>;

/** POST /api/public/:slug/orders/:id/receipt-email — mail the fiscal receipt (PDF attached) to the guest. */
export const receiptEmailSchema = z.object({ email: z.email().max(200) });
export type ReceiptEmailInput = z.infer<typeof receiptEmailSchema>;
