import { z } from 'zod';
import { PAYMENT_LIMITS, PAYMENT_PROVIDERS } from '../payments.js';

/** POST /api/public/:slug/orders/:id/payments — the guest picks a tip and gets the QR / deep link. */
export const createPaymentSchema = z.object({
  tipPercent: z.number().int().min(0).max(PAYMENT_LIMITS.tipPercentMax).default(0),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** PATCH /admin/restaurants/:id/orders/:orderId/payment — staff took cash (the only manual state). */
export const markOrderPaymentSchema = z.object({
  paymentStatus: z.literal('cash'),
});
export type MarkOrderPaymentInput = z.infer<typeof markOrderPaymentSchema>;

export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);

/**
 * PATCH /admin/restaurants/:id/payment-config (owner, payments module on). `secret` is write-only: sent to change it,
 * never returned; the DTO only says whether one is set.
 */
export const updatePaymentConfigSchema = z
  .object({
    provider: paymentProviderSchema,
    merchantId: z.string().trim().max(PAYMENT_LIMITS.merchantIdMax).nullable(),
    secret: z.string().trim().min(1).max(PAYMENT_LIMITS.secretMax),
    tipPresets: z
      .array(z.number().int().min(0).max(PAYMENT_LIMITS.tipPercentMax))
      .max(PAYMENT_LIMITS.tipPresetsMax)
      .transform((presets) => [...new Set(presets)].sort((a, b) => a - b)),
    receiptEmailEnabled: z.boolean(),
  })
  .partial();
export type UpdatePaymentConfigInput = z.infer<typeof updatePaymentConfigSchema>;
