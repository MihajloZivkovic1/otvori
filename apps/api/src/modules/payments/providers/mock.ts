import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { PAYMENT_LIMITS } from '@qr-menu/shared';
import { env } from '../../../config/env.js';
import { hmacSha256Hex, safeEqualHex } from '../../../utils/crypto.js';
import { AppError } from '../../../utils/errors.js';
import type { CreatePaymentParams, CreatedPayment, MerchantCredentials, PaymentProvider, StatusResult, WebhookResult } from './types.js';

/** Signed webhook body the simulator (GET /dev/pay/:ref) posts to POST /api/webhooks/payments/mock. */
export const mockWebhookSchema = z.object({
  providerRef: z.string().min(1),
  status: z.enum(['paid', 'failed', 'expired']),
  amountCents: z.number().int().nonnegative(),
  paidAt: z.iso.datetime({ offset: true }).nullable().default(null),
});
export type MockWebhookBody = z.infer<typeof mockWebhookSchema>;

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** Signs a webhook body the way the "bank" would: hex HMAC-SHA256 of the exact JSON bytes with the merchant secret. */
export function signMockWebhook(secret: string, body: MockWebhookBody): { json: string; signature: string } {
  const json = JSON.stringify(body);
  return { json, signature: hmacSha256Hex(secret, json) };
}

/**
 * In-memory record of what the simulator did with each reference, so `getStatus` (the reconciliation path) can
 * answer like a real gateway would. Lost on restart, which only means "still pending".
 */
const outcomes = new Map<string, { status: 'paid' | 'failed'; amountCents: number; paidAt: Date | null }>();

export function recordMockOutcome(providerRef: string, outcome: { status: 'paid' | 'failed'; amountCents: number; paidAt: Date | null }): void {
  outcomes.set(providerRef, outcome);
}

export function resetMockOutcomes(): void {
  outcomes.clear();
}

/**
 * Development / demo gateway. The QR encodes the simulator page URL (GET /dev/pay/:ref, PAYMENTS_MOCK=true), so any
 * phone that scans it can "pay" or "decline"; the page then fires a signed webhook into our own endpoint, exactly
 * like a bank would. Also the deep link, so a single-phone demo works ("Open the banking app" opens the simulator).
 */
export const mockProvider: PaymentProvider = {
  key: 'mock',

  async createPayment(_params: CreatePaymentParams): Promise<CreatedPayment> {
    const providerRef = `mock_${randomBytes(12).toString('hex')}`;
    const url = `${env.API_URL}/dev/pay/${providerRef}`;
    return {
      providerRef,
      qrPayload: url,
      deepLink: url,
      expiresAt: new Date(Date.now() + PAYMENT_LIMITS.expiryMinutes * 60_000),
    };
  },

  async parseWebhook(req: Request, lookupSecret): Promise<WebhookResult> {
    const raw = req.rawBody;
    const body = mockWebhookSchema.parse(req.body);
    const credentials = await lookupSecret(body.providerRef);
    const signature = req.get(MOCK_SIGNATURE_HEADER) ?? '';
    const expected = credentials?.secret && raw ? hmacSha256Hex(credentials.secret, raw) : null;
    if (!expected || !safeEqualHex(signature, expected)) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature does not match');
    }
    return {
      providerRef: body.providerRef,
      status: body.status,
      amountCents: body.amountCents,
      paidAt: body.paidAt ? new Date(body.paidAt) : body.status === 'paid' ? new Date() : null,
      raw: body,
    };
  },

  async getStatus(providerRef: string): Promise<StatusResult> {
    const outcome = outcomes.get(providerRef);
    if (!outcome) return { status: 'pending', amountCents: null, paidAt: null, raw: { source: 'mock', known: false } };
    return { status: outcome.status, amountCents: outcome.amountCents, paidAt: outcome.paidAt, raw: { source: 'mock', ...outcome } };
  },

  async testConnection(credentials: MerchantCredentials) {
    if (!env.PAYMENTS_MOCK) return { ok: false, message: 'The simulator is off on this server (PAYMENTS_MOCK is not set)' };
    if (!credentials.secret) return { ok: false, message: 'Set a secret first: the simulator signs its webhooks with it' };
    return { ok: true, message: `Simulator ready — payments open ${env.API_URL}/dev/pay/<ref>` };
  },
};
