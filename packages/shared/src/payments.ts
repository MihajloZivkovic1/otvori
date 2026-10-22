import type { OrderStatus } from './constants.js';

/**
 * Online payment (Phase 9c). The venue holds the merchant contract with its bank (OTP eCommerce / Monri WSPay);
 * guests pay an accepted order with their banking app through the Serbian IPS instant-payment scheme. otvori only
 * creates the payment, shows the QR / deep link and receives the webhook — the money goes to the venue.
 */
export const PAYMENT_PROVIDERS = ['mock', 'otp'] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number];

/** Order-level payment state. `cash` is set by staff; the rest follows the payment attempts. */
export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'cash'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One attempt at the provider (a guest may retry after a failure or an expiry). */
export const PAYMENT_ATTEMPT_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/** Fiscal receipt state of a paid order (Phase 9d, POS integration). */
/** `manual` = staff issued the receipt at the register themselves (no retry, nothing for the guest). */
export const FISCAL_STATUSES = ['none', 'pending', 'issued', 'failed', 'manual'] as const;
export type FiscalStatus = (typeof FISCAL_STATUSES)[number];

export const PAYMENT_LIMITS = {
  /** A tip above this share of the order is almost certainly a typo. */
  tipPercentMax: 50,
  tipPresetsMax: 6,
  /** A payment QR / deep link is valid this long; afterwards the guest starts a new attempt. */
  expiryMinutes: 10,
  /** Pending attempts older than this are reconciled by polling the provider (missed webhooks). */
  reconcileAfterMinutes: 2,
  reconcileIntervalMs: 60_000,
  /** Guest polls the attempt status this often. */
  pollMs: 3_000,
  merchantIdMax: 100,
  secretMax: 500,
} as const;

export const DEFAULT_TIP_PRESETS: readonly number[] = [0, 5, 10, 15];

/** Online payment is offered for accepted or delivered orders that are not yet paid (online or in cash). */
export function canPayOrder(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return (order.status === 'accepted' || order.status === 'delivered') && !['paid', 'cash'].includes(order.paymentStatus);
}

export function tipCentsFor(totalCents: number, tipPercent: number): number {
  return Math.round((totalCents * tipPercent) / 100);
}

export function isFinalAttemptStatus(status: PaymentAttemptStatus): boolean {
  return status !== 'pending';
}
