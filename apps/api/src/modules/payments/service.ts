import type { Request } from 'express';
import { Op, Transaction } from 'sequelize';
import {
  PAYMENT_LIMITS,
  canPayOrder,
  tipCentsFor,
  type CreatePaymentInput,
  type OrderDto,
  type PaymentAttemptStatus,
  type PaymentConfigDto,
  type PublicPaymentDto,
  type UpdatePaymentConfigInput,
} from '@qr-menu/shared';
import { featureEnabled, moduleOn } from '../../config/features.js';
import { env } from '../../config/env.js';
import { Order, OrderItem, Payment, Restaurant } from '../../db/models/index.js';
import type { StoredPaymentConfig } from '../../db/models/restaurant.model.js';
import { sequelize } from '../../db/sequelize.js';
import { moduleDisabled } from '../../middleware/modules.js';
import { encryptSecret } from '../../utils/crypto.js';
import { AppError, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import * as audit from '../audit/service.js';
import { toIso } from '../../utils/objects.js';
import { publishOrder, toOrderDto } from '../ordering/service.js';
import { registerMismatch } from '../pos/service.js';
import { loadPublishedRestaurant } from '../public/service.js';
import { credentialsOf, storedConfig, toPaymentConfigDto } from './config.js';
import { runCashOrderHooks, runPaidOrderHooks } from './hooks.js';
import { isPaymentProviderKey, paymentProvider } from './providers/index.js';
import type { StatusResult, WebhookResult } from './providers/types.js';

const ITEMS_INCLUDE = { model: OrderItem, as: 'items' } as const;

/* ------------------------------------------------------------------ config */

async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId);
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

export async function getPaymentConfig(restaurantId: string): Promise<PaymentConfigDto> {
  return toPaymentConfigDto(await loadRestaurant(restaurantId));
}

export async function updatePaymentConfig(restaurantId: string, input: UpdatePaymentConfigInput): Promise<PaymentConfigDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const current = storedConfig(restaurant);
  const next: StoredPaymentConfig = {
    provider: input.provider ?? current.provider,
    merchantId: input.merchantId === undefined ? current.merchantId : input.merchantId || null,
    secretEncrypted: input.secret === undefined ? current.secretEncrypted : encryptSecret(input.secret),
    tipPresets: input.tipPresets ?? current.tipPresets,
    receiptEmailEnabled: input.receiptEmailEnabled ?? current.receiptEmailEnabled,
  };
  if (!next.tipPresets.includes(0)) next.tipPresets = [0, ...next.tipPresets];
  await restaurant.update({ paymentConfig: next });
  const shape = (c: StoredPaymentConfig) => ({ provider: c.provider, merchantId: c.merchantId, tipPresets: c.tipPresets, receiptEmailEnabled: c.receiptEmailEnabled, hasSecret: c.secretEncrypted !== null });
  const changes = audit.diff(shape(current), shape(next));
  if (changes || input.secret !== undefined) {
    await audit.record({
      restaurantId,
      action: 'payment_config.update',
      entity: { type: 'restaurant', id: restaurantId, label: restaurant.name },
      before: changes?.before ?? {},
      after: { ...(changes?.after ?? {}), ...(input.secret !== undefined ? { secretChanged: true } : {}) },
    });
  }
  return toPaymentConfigDto(restaurant);
}

export async function testPaymentConnection(restaurantId: string): Promise<{ ok: boolean; message: string }> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedConfig(restaurant);
  if (!config.provider) return { ok: false, message: 'Choose a provider first' };
  try {
    return await paymentProvider(config.provider).testConnection(credentialsOf(restaurant));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Connection failed' };
  }
}

/** Provider payloads are stored as JSON for support; non-object values are wrapped. */
function asJson(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? (value as Record<string, unknown>) : { value };
}

/* ------------------------------------------------------------------ DTOs */

function toPublicPaymentDto(payment: Payment, currency: string): PublicPaymentDto {
  return {
    ref: payment.providerRef,
    status: payment.status,
    baseCents: payment.baseCents,
    tipCents: payment.tipCents,
    amountCents: payment.amountCents,
    currency,
    qrPayload: payment.qrPayload,
    deepLink: payment.deepLink,
    expiresAt: payment.expiresAt.toISOString(),
    paidAt: toIso(payment.paidAt),
  };
}

/* ------------------------------------------------------------------ guest */

const paymentNotAllowed = (message: string) => new AppError(409, 'PAYMENT_NOT_ALLOWED', message);

function assertPaymentsEnabled(restaurant: Restaurant): void {
  // The route guard already answers 404 while the feature is off; this keeps the service honest when called directly.
  if (!featureEnabled('payments')) throw notFound();
  if (!moduleOn(restaurant, 'payments')) throw moduleDisabled('payments');
}

/**
 * POST /api/public/:slug/orders/:id/payments — creates a payment attempt at the venue's provider for an accepted
 * (or delivered) order. A still-valid pending attempt with the same tip is returned as is; a different tip starts a
 * fresh one (the previous QR is marked expired but a late "paid" webhook for it is still honoured).
 */
export async function createPayment(slug: string, sessionId: string, orderId: string, input: CreatePaymentInput): Promise<PublicPaymentDto> {
  const restaurant = await loadPublishedRestaurant(slug);
  assertPaymentsEnabled(restaurant);
  const order = await Order.findOne({ where: { id: orderId, restaurantId: restaurant.id, sessionId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  if (!canPayOrder(order)) {
    throw paymentNotAllowed(
      order.paymentStatus === 'paid' || order.paymentStatus === 'cash'
        ? 'This order is already paid'
        : 'An order can be paid once the waiter has accepted it',
    );
  }

  // Mixed orders: what the waiter typed at the register is not in this order — the guest pays the whole table there.
  const mismatch = await registerMismatch(restaurant, order);
  if (mismatch) {
    throw new AppError(409, 'POS_MISMATCH', 'The register has items that are not in this order; please pay the whole bill at the waiter', mismatch);
  }

  const tipCents = tipCentsFor(order.totalCents, input.tipPercent);
  const now = new Date();
  const pending = await Payment.findOne({
    where: { orderId: order.id, status: 'pending', expiresAt: { [Op.gt]: now } },
    order: [['createdAt', 'DESC']],
  });
  if (pending && pending.tipCents === tipCents) return toPublicPaymentDto(pending, restaurant.currency);

  const config = storedConfig(restaurant);
  const provider = paymentProvider(config.provider);
  const credentials = credentialsOf(restaurant);
  const amountCents = order.totalCents + tipCents;
  const created = await provider.createPayment({
    order,
    amountCents,
    tipCents,
    currency: restaurant.currency,
    description: `${restaurant.name} · #${order.number}`,
    callbackUrl: `${env.API_URL}/api/webhooks/payments/${provider.key}`,
    credentials,
  });

  const payment = await sequelize.transaction(async (transaction) => {
    if (pending) await pending.update({ status: 'expired' }, { transaction });
    const row = await Payment.create(
      {
        restaurantId: restaurant.id,
        orderId: order.id,
        provider: provider.key,
        providerRef: created.providerRef,
        baseCents: order.totalCents,
        tipCents,
        amountCents,
        qrPayload: created.qrPayload,
        deepLink: created.deepLink ?? null,
        expiresAt: created.expiresAt,
      },
      { transaction },
    );
    await order.update({ paymentStatus: 'pending', tipCents, providerRef: created.providerRef }, { transaction });
    return row;
  });
  publishOrder('order.updated', await reloadOrder(order.id));
  return toPublicPaymentDto(payment, restaurant.currency);
}

/** GET /api/public/:slug/orders/:id/payments/:ref — the attempt's state; a stale pending one reads as expired. */
export async function getPaymentStatus(slug: string, sessionId: string, orderId: string, ref: string, now = new Date()): Promise<PublicPaymentDto> {
  const restaurant = await loadPublishedRestaurant(slug);
  const order = await Order.findOne({ where: { id: orderId, restaurantId: restaurant.id, sessionId }, attributes: ['id'] });
  if (!order) throw notFound('Order not found');
  const payment = await Payment.findOne({ where: { orderId: order.id, providerRef: ref } });
  if (!payment) throw notFound('Payment not found', 'PAYMENT_NOT_FOUND');
  if (payment.status === 'pending' && payment.expiresAt.getTime() <= now.getTime()) {
    await applyPaymentResult(payment.id, { status: 'expired', amountCents: null, paidAt: null, raw: { source: 'expiry' } });
    return toPublicPaymentDto((await Payment.findByPk(payment.id))!, restaurant.currency);
  }
  return toPublicPaymentDto(payment, restaurant.currency);
}

/* ------------------------------------------------------------------ results (webhook, reconciliation, expiry) */

/** Webhook results applied after the 200 was sent; tests (and shutdown) can wait for them. */
const inFlight = new Set<Promise<void>>();

export function trackBackground(work: Promise<void>): void {
  const tracked = work.finally(() => inFlight.delete(tracked));
  inFlight.add(tracked);
}

export async function settleBackgroundWork(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

async function reloadOrder(orderId: string): Promise<Order> {
  return (await Order.findByPk(orderId, { include: [ITEMS_INCLUDE] }))!;
}

/**
 * Applies a provider result to an attempt and its order, idempotently: a final attempt is never changed again
 * except that "paid" always wins (money moved), even for an attempt we had marked expired. The order's
 * `paymentStatus` follows only its latest attempt, so an old failure cannot clobber a newer pending one.
 * Returns true when the order became paid by this call.
 */
export async function applyPaymentResult(paymentId: string, result: StatusResult | WebhookResult): Promise<boolean> {
  const outcome = await sequelize.transaction(async (transaction) => {
    const payment = await Payment.findByPk(paymentId, { transaction, lock: Transaction.LOCK.UPDATE });
    if (!payment) return { changed: false, paid: false, orderId: null };
    const order = await Order.findByPk(payment.orderId, { transaction, lock: Transaction.LOCK.UPDATE });
    if (!order) return { changed: false, paid: false, orderId: null };

    if (result.status === 'pending') return { changed: false, paid: false, orderId: order.id };
    if (payment.status === 'paid') return { changed: false, paid: false, orderId: order.id };
    if (payment.status !== 'pending' && result.status !== 'paid') return { changed: false, paid: false, orderId: order.id };

    if (result.status === 'paid') {
      const amount = result.amountCents ?? payment.amountCents;
      if (amount < payment.amountCents) {
        logger.warn({ paymentId, expected: payment.amountCents, got: amount }, 'Payment amount lower than requested; left pending');
        return { changed: false, paid: false, orderId: order.id };
      }
      const paidAt = result.paidAt ?? new Date();
      await payment.update({ status: 'paid', paidAt, raw: asJson(result.raw) }, { transaction });
      const alreadyPaid = order.paymentStatus === 'paid';
      if (!alreadyPaid) {
        await order.update(
          { paymentStatus: 'paid', paidAmountCents: amount, paidAt, tipCents: payment.tipCents, providerRef: payment.providerRef },
          { transaction },
        );
      }
      return { changed: true, paid: !alreadyPaid, orderId: order.id };
    }

    await payment.update({ status: result.status, raw: asJson(result.raw) }, { transaction });
    if (order.providerRef === payment.providerRef && order.paymentStatus === 'pending') {
      await order.update({ paymentStatus: result.status === 'failed' ? 'failed' : 'unpaid' }, { transaction });
    }
    return { changed: true, paid: false, orderId: order.id };
  });

  if (outcome.changed && outcome.orderId) {
    const order = await reloadOrder(outcome.orderId);
    publishOrder('order.updated', order);
    if (outcome.paid) await runPaidOrderHooks(order);
  }
  return outcome.paid;
}

/**
 * POST /api/webhooks/payments/:provider. The provider verifies the signature (with the secret of the venue that
 * owns the reference) and maps the body; the caller answers 200 as soon as that succeeded and the result is
 * applied in the background. Unknown references are acknowledged (and logged) so the gateway stops retrying.
 */
export async function receiveWebhook(providerKey: string, req: Request): Promise<{ apply: () => Promise<void> }> {
  if (!isPaymentProviderKey(providerKey)) throw notFound('Unknown payment provider');
  const provider = paymentProvider(providerKey);
  let matched: Payment | null = null;
  const result = await provider.parseWebhook(req, async (providerRef) => {
    matched = await Payment.findOne({ where: { provider: providerKey, providerRef }, include: [{ model: Restaurant, attributes: ['id', 'paymentConfig'] }] });
    return matched?.restaurant ? credentialsOf(matched.restaurant) : null;
  });
  const payment = matched as Payment | null;
  return {
    apply: async () => {
      if (!payment) {
        logger.warn({ provider: providerKey, providerRef: result.providerRef }, 'Webhook for an unknown payment');
        return;
      }
      try {
        await applyPaymentResult(payment.id, result);
      } catch (error) {
        logger.error({ err: error, paymentId: payment.id }, 'Applying a payment webhook failed');
      }
    },
  };
}

/** Pending attempts older than the threshold: ask the provider (a missed webhook) and expire what the QR no longer covers. */
export async function reconcilePendingPayments(now = new Date()): Promise<{ checked: number; changed: number }> {
  const cutoff = new Date(now.getTime() - PAYMENT_LIMITS.reconcileAfterMinutes * 60_000);
  const pending = await Payment.findAll({
    where: { status: 'pending', createdAt: { [Op.lt]: cutoff } },
    include: [{ model: Restaurant, attributes: ['id', 'paymentConfig'] }],
    limit: 200,
  });
  let changed = 0;
  for (const payment of pending) {
    try {
      let result: StatusResult = { status: 'pending', amountCents: null, paidAt: null, raw: null };
      try {
        result = await paymentProvider(payment.provider).getStatus(payment.providerRef, credentialsOf(payment.restaurant!));
      } catch (error) {
        logger.warn({ err: error, paymentId: payment.id }, 'Provider status poll failed');
      }
      if (result.status === 'pending' && payment.expiresAt.getTime() <= now.getTime()) {
        result = { status: 'expired', amountCents: null, paidAt: null, raw: { source: 'reconcile' } };
      }
      if (result.status !== 'pending') {
        await applyPaymentResult(payment.id, result);
        changed += 1;
      }
    } catch (error) {
      logger.error({ err: error, paymentId: payment.id }, 'Reconciling a payment failed');
    }
  }
  return { checked: pending.length, changed };
}

/* ------------------------------------------------------------------ staff */

/** PATCH /admin/restaurants/:id/orders/:orderId/payment { paymentStatus: 'cash' } — the waiter took cash. */
export async function markOrderCash(restaurantId: string, orderId: string, now = new Date()): Promise<OrderDto> {
  const restaurant = await loadRestaurant(restaurantId);
  assertPaymentsEnabled(restaurant);
  const order = await Order.findOne({ where: { id: orderId, restaurantId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  if (order.paymentStatus === 'paid') throw paymentNotAllowed('This order was already paid online');
  if (order.paymentStatus === 'cash') return toOrderDto(order);
  await order.update({ paymentStatus: 'cash', paidAt: now, paidAmountCents: order.totalCents, tipCents: 0 });
  const fresh = await reloadOrder(order.id);
  publishOrder('order.updated', fresh);
  await audit.record({ restaurantId, action: 'order.cash', entity: { type: 'order', id: order.id, label: `#${order.number}` }, after: { tableNumber: order.tableNumber, totalCents: order.totalCents } });
  await runCashOrderHooks(fresh);
  return toOrderDto(fresh);
}

export type { PaymentAttemptStatus };
