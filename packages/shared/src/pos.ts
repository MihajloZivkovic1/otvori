import { z } from 'zod';

/**
 * POS integration (Phase 9d): accepted orders are opened on the venue's register and, once the guest has paid
 * online, closed with a fiscal receipt. First provider: Octopos (docs/octopos.md); `mock` logs what it would send
 * and returns a fake receipt (POS_MOCK=true).
 */
export const POS_PROVIDERS = ['mock', 'octopos'] as const;
export type PosProviderKey = (typeof POS_PROVIDERS)[number];

/**
 * Whether closing an order that was already opened on a table is a second /weborder with the same ExternalId
 * (`reuse-external-id`) or a separate receipt (`new-receipt`). The Octopos docs do not say; confirm in the sandbox.
 */
export const POS_CLOSE_MODES = ['reuse-external-id', 'new-receipt'] as const;
export type PosCloseMode = (typeof POS_CLOSE_MODES)[number];

export const POS_JOB_TYPES = ['send_order', 'close_order'] as const;
export type PosJobType = (typeof POS_JOB_TYPES)[number];

export const POS_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type PosJobStatus = (typeof POS_JOB_STATUSES)[number];

export const POS_LIMITS = {
  /** Retry delays in seconds after the 1st, 2nd, … failure; after the last one the job is `failed`. */
  retryDelaysSeconds: [30, 120, 600, 1800, 7200] as readonly number[],
  /** How often the queue is polled. */
  pollMs: 10_000,
  baseUrlMax: 200,
  apiKeyMax: 1000,
  productCodeMax: 64,
  tableNameMax: 64,
  /** Octopos: textual receipt width (32–60). */
  receiptLineWidth: 40,
} as const;

/** ExternalId prefix: `otvori-<orderId>` in production, `otvori-dev-<orderId>` against the shared sandbox. */
export function posExternalId(orderId: string, dev: boolean): string {
  return `${dev ? 'otvori-dev-' : 'otvori-'}${orderId}`;
}

export const posConfigDtoSchema = z.object({
  provider: z.enum(POS_PROVIDERS).nullable(),
  baseUrl: z.string().nullable(),
  hasApiKey: z.boolean(),
  /** Our table id → the POS table name (Octopos `TableName`). */
  tableMapping: z.record(z.string(), z.string()),
  sendOrdersToPos: z.boolean(),
  closeOnPayment: z.boolean(),
  printOnClose: z.boolean(),
  closeMode: z.enum(POS_CLOSE_MODES),
  /** True when the venue runs on the mock POS and POS_MOCK is on. */
  simulator: z.boolean(),
});
export type PosConfigDto = z.infer<typeof posConfigDtoSchema>;

/** PATCH /admin/restaurants/:id/pos-config (owner, pos module on); `apiKey` is write-only. */
export const updatePosConfigSchema = z
  .object({
    provider: z.enum(POS_PROVIDERS),
    baseUrl: z.url().max(POS_LIMITS.baseUrlMax).nullable(),
    apiKey: z.string().trim().min(1).max(POS_LIMITS.apiKeyMax),
    tableMapping: z.record(z.string().uuid(), z.string().trim().max(POS_LIMITS.tableNameMax)),
    sendOrdersToPos: z.boolean(),
    closeOnPayment: z.boolean(),
    printOnClose: z.boolean(),
    closeMode: z.enum(POS_CLOSE_MODES),
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

/** POST /api/public/:slug/orders/:id/receipt-email — mail the fiscal receipt to the guest. */
export const receiptEmailSchema = z.object({ email: z.email().max(200) });
export type ReceiptEmailInput = z.infer<typeof receiptEmailSchema>;
