import type { Request } from 'express';
import type { PaymentAttemptStatus, PaymentProviderKey } from '@qr-menu/shared';
import type { Order } from '../../../db/models/order.model.js';

/** What the venue configured (decrypted for the provider call only). */
export interface MerchantCredentials {
  merchantId: string | null;
  secret: string | null;
}

export interface CreatePaymentParams {
  order: Order;
  /** What the guest is asked to pay: the order total plus the tip. */
  amountCents: number;
  tipCents: number;
  currency: string;
  description: string;
  /** Where the provider posts the result (POST /api/webhooks/payments/:provider). */
  callbackUrl: string;
  credentials: MerchantCredentials;
}

export interface CreatedPayment {
  providerRef: string;
  /** Text the guest's banking app reads from the QR (IPS payment string, or the simulator URL on mock). */
  qrPayload: string;
  deepLink?: string | null;
  expiresAt: Date;
}

export interface WebhookResult {
  providerRef: string;
  status: Extract<PaymentAttemptStatus, 'paid' | 'failed' | 'expired'>;
  amountCents: number;
  paidAt: Date | null;
  raw: unknown;
}

export interface StatusResult {
  status: PaymentAttemptStatus;
  amountCents: number | null;
  paidAt: Date | null;
  raw: unknown;
}

/**
 * A bank e-commerce gateway. Instances are stateless; the venue's credentials are passed per call. Everything a
 * provider returns is untrusted input: the service re-checks amounts against the attempt it created.
 */
export interface PaymentProvider {
  readonly key: PaymentProviderKey;
  createPayment(params: CreatePaymentParams): Promise<CreatedPayment>;
  /**
   * Verifies the request's signature with the venue's secret and maps it to a result. `lookupSecret` resolves the
   * secret from the reference inside the (unverified) body, so the caller keeps the data flow explicit.
   * Throws `INVALID_SIGNATURE` (401) when the signature does not match.
   */
  parseWebhook(req: Request, lookupSecret: (providerRef: string) => Promise<MerchantCredentials | null>): Promise<WebhookResult>;
  getStatus(providerRef: string, credentials: MerchantCredentials): Promise<StatusResult>;
  /** Settings → "Test connection". */
  testConnection(credentials: MerchantCredentials): Promise<{ ok: boolean; message: string }>;
}
