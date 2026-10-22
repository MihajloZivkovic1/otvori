import type { Request } from 'express';
import { PAYMENT_LIMITS } from '@qr-menu/shared';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import type { CreatePaymentParams, CreatedPayment, MerchantCredentials, PaymentProvider, StatusResult, WebhookResult } from './types.js';

/*
 * OTP banka Srbija eCommerce — IPS instant payments ("IPS pokaži" / "IPS skeniraj").
 *
 * Skeleton only: the request/response shapes below follow the public description of the bank's e-commerce gateway
 * (merchant-initiated payment order → the bank returns an IPS QR string + a deep link; the result arrives on a
 * signed callback and can be polled). The exact field names, the signing scheme and the endpoint paths are
 * confirmed when the venue's merchant contract and the integration documentation arrive.
 *
 * TODO(otp): confirm with the bank —
 *   1. base URL for sandbox/production (OTP_ECOM_BASE_URL) and the authentication (merchant id + API key / mTLS);
 *   2. the "create payment order" request (`amount`, `currency` = RSD/941, `orderId`, `description`,
 *      `callbackUrl`, `expiresIn`) and its response (`paymentId`, `ipsQrText`, `deepLink`, `expiresAt`);
 *   3. the callback signature (HMAC over the raw body vs. a signed field list) and the status values;
 *   4. the status query endpoint and whether declined / expired are distinct;
 *   5. refund / void — not needed for v1 (tips are part of the amount, the venue refunds at the register).
 */

interface OtpCreateRequest {
  merchantId: string;
  amount: number; // minor units
  currency: 'RSD';
  orderReference: string; // our order id
  description: string;
  callbackUrl: string;
  expiresInSeconds: number;
}

interface OtpCreateResponse {
  paymentId: string;
  ipsQrText: string;
  deepLink?: string;
  expiresAt: string;
}

interface OtpCallbackBody {
  paymentId: string;
  status: 'PAID' | 'DECLINED' | 'EXPIRED';
  amount: number;
  paidAt?: string;
}

interface OtpStatusResponse {
  paymentId: string;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'EXPIRED';
  amount: number;
  paidAt?: string;
}

const STATUS: Record<OtpCallbackBody['status'] | 'PENDING', StatusResult['status']> = {
  PENDING: 'pending',
  PAID: 'paid',
  DECLINED: 'failed',
  EXPIRED: 'expired',
};

function notConfigured(): never {
  throw new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'The OTP eCommerce gateway is not configured on this server yet');
}

function baseUrl(): string {
  return env.OTP_ECOM_BASE_URL ?? notConfigured();
}

async function call<T>(path: string, credentials: MerchantCredentials, body?: unknown): Promise<T> {
  if (!credentials.merchantId || !credentials.secret) notConfigured();
  const response = await fetch(`${baseUrl()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      // TODO(otp): replace with the bank's scheme (API key header, signed request or mTLS).
      Authorization: `Bearer ${credentials.secret}`,
      'X-Merchant-Id': credentials.merchantId,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.warn({ status: response.status, path, text: text.slice(0, 200) }, 'OTP eCommerce call failed');
    throw new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', `The bank gateway answered ${response.status}`);
  }
  return (await response.json()) as T;
}

export const otpProvider: PaymentProvider = {
  key: 'otp',

  async createPayment(params: CreatePaymentParams): Promise<CreatedPayment> {
    const request: OtpCreateRequest = {
      merchantId: params.credentials.merchantId ?? '',
      amount: params.amountCents,
      currency: 'RSD',
      orderReference: params.order.id,
      description: params.description,
      callbackUrl: params.callbackUrl,
      expiresInSeconds: PAYMENT_LIMITS.expiryMinutes * 60,
    };
    const created = await call<OtpCreateResponse>('/payments', params.credentials, request);
    return {
      providerRef: created.paymentId,
      qrPayload: created.ipsQrText,
      deepLink: created.deepLink ?? null,
      expiresAt: new Date(created.expiresAt),
    };
  },

  async parseWebhook(req: Request, lookupSecret): Promise<WebhookResult> {
    const body = req.body as Partial<OtpCallbackBody>;
    if (!body.paymentId || !body.status) throw new AppError(400, 'VALIDATION_ERROR', 'Malformed callback');
    const credentials = await lookupSecret(body.paymentId);
    // TODO(otp): verify the callback signature with `credentials.secret` over `req.rawBody` once the scheme is known.
    if (!credentials?.secret) throw new AppError(401, 'INVALID_SIGNATURE', 'Unknown payment or missing secret');
    notConfigured();
  },

  async getStatus(providerRef: string, credentials: MerchantCredentials): Promise<StatusResult> {
    const status = await call<OtpStatusResponse>(`/payments/${encodeURIComponent(providerRef)}`, credentials);
    return {
      status: STATUS[status.status],
      amountCents: status.amount,
      paidAt: status.paidAt ? new Date(status.paidAt) : null,
      raw: status,
    };
  },

  async testConnection(credentials: MerchantCredentials) {
    if (!env.OTP_ECOM_BASE_URL) return { ok: false, message: 'OTP eCommerce is not configured on this server (OTP_ECOM_BASE_URL)' };
    if (!credentials.merchantId || !credentials.secret) return { ok: false, message: 'Merchant ID and secret are required' };
    // TODO(otp): call a cheap authenticated endpoint once it is known.
    return { ok: false, message: 'Connection test not available until the bank integration is confirmed' };
  },
};
