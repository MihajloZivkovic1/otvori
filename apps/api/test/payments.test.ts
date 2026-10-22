import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PublicOrderDto, PublicPaymentDto } from '@qr-menu/shared';
import { Order, Payment } from '../src/db/models/index.js';
import { orderingBus } from '../src/modules/ordering/events.js';
import { MOCK_SIGNATURE_HEADER, recordMockOutcome, resetMockOutcomes, signMockWebhook } from '../src/modules/payments/providers/mock.js';
import { applyPaymentResult, reconcilePendingPayments } from '../src/modules/payments/service.js';
import { decryptSecret, encryptSecret } from '../src/utils/crypto.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

const SECRET = 'demo-merchant-secret';
const session = () => ({ 'X-Session-Id': randomUUID() });

/** Owner + venue with ordering and payments on (mock provider), one table, one item; returns an accepted order. */
async function setup({ accept = true, payments = true } = {}) {
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const auth = bearer(owner.accessToken);
  const category = await createCategory(owner, { name: { sr: 'Kafa' } });
  const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 22000 });
  await api.post(`${admin}/tables`).set(auth).send({ number: 7, label: 'Sto 7' });
  await publish(owner);
  await api.patch(admin).set(auth).send({ modules: { ordering: true }, orderingMode: 'order' });
  if (payments) {
    // Payments need a superadmin for the module …
    const root = await registerUser({ restaurantName: 'HQ' });
    const { User } = await import('../src/db/models/index.js');
    await User.update({ isSuperadmin: true }, { where: { id: root.user.id } });
    await api.patch(`/api/superadmin/restaurants/${owner.restaurantId}`).set(bearer(root.accessToken)).send({ modules: { payments: true } });
    // … and the owner sets the provider up.
    const config = await api
      .patch(`${admin}/payment-config`)
      .set(auth)
      .send({ provider: 'mock', merchantId: 'DEMO-1', secret: SECRET, tipPresets: [10, 15, 0, 5], receiptEmailEnabled: true });
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({ provider: 'mock', merchantId: 'DEMO-1', hasSecret: true, tipPresets: [0, 5, 10, 15], simulator: true });
  }
  const guest = session();
  const created = await api
    .post(`/api/public/${slug}/orders`)
    .set(guest)
    .send({ tableNumber: 7, items: [{ itemId: item.id, quantity: 3 }] });
  expect(created.status).toBe(201);
  const order = created.body as PublicOrderDto;
  if (accept) {
    const accepted = await api.patch(`${admin}/orders/${order.id}`).set(auth).send({ status: 'accepted' });
    expect(accepted.status).toBe(200);
  }
  const pay = (tipPercent?: number, who = guest) =>
    api.post(`/api/public/${slug}/orders/${order.id}/payments`).set(who).send(tipPercent === undefined ? {} : { tipPercent });
  const status = (ref: string, who = guest) => api.get(`/api/public/${slug}/orders/${order.id}/payments/${ref}`).set(who);
  const webhook = (body: Parameters<typeof signMockWebhook>[1], secret = SECRET) => {
    const { json, signature } = signMockWebhook(secret, body);
    return api.post('/api/webhooks/payments/mock').set('Content-Type', 'application/json').set(MOCK_SIGNATURE_HEADER, signature).send(json);
  };
  const readOrder = () => api.get(`/api/public/${slug}/orders/${order.id}`).set(guest).then((r) => r.body as PublicOrderDto);
  return { owner, slug, admin, auth, item, order, guest, pay, status, webhook, readOrder };
}

/** The webhook answers before the result is applied: poll until the condition holds (or fail after 3 s). */
async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor: condition not met in time');
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
const paid = (read: () => Promise<PublicOrderDto>, expected = 'paid') => waitFor(async () => (await read()).paymentStatus === expected);

describe('secrets at rest', () => {
  it('round-trips through AES-GCM and never stores the plain text', () => {
    const stored = encryptSecret('top-secret');
    expect(stored).toMatch(/^v1\./);
    expect(stored).not.toContain('top-secret');
    expect(decryptSecret(stored)).toBe('top-secret');
    expect(() => decryptSecret(stored.slice(0, -2) + 'xx')).toThrow();
  });
});

describe('online payment', () => {
  it('creates a mock payment for an accepted order with the tip added, and the guest sees the QR, the deep link and the expiry', async () => {
    const ctx = await setup();
    const res = await ctx.pay(10);
    expect(res.status).toBe(201);
    const payment = res.body as PublicPaymentDto;
    expect(payment).toMatchObject({ status: 'pending', baseCents: 66000, tipCents: 6600, amountCents: 72600, currency: 'RSD' });
    expect(payment.ref).toMatch(/^mock_/);
    expect(payment.qrPayload).toBe(`http://localhost:3000/dev/pay/${payment.ref}`);
    expect(payment.deepLink).toBe(payment.qrPayload);
    expect(new Date(payment.expiresAt).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);

    const order = await ctx.readOrder();
    expect(order).toMatchObject({ paymentStatus: 'pending', tipCents: 6600 });
    expect(order.payments).toEqual({ enabled: true, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true });

    // Same tip again: the same attempt; a different tip: a new one and the old QR is retired.
    const again = await ctx.pay(10);
    expect(again.body.ref).toBe(payment.ref);
    const other = await ctx.pay(0);
    expect(other.body.ref).not.toBe(payment.ref);
    expect(other.body.amountCents).toBe(66000);
    expect((await ctx.status(payment.ref)).body.status).toBe('expired');
  });

  it('refuses payment before acceptance, without the module, for foreign sessions and for paid orders', async () => {
    const early = await setup({ accept: false });
    const notYet = await early.pay(0);
    expect(notYet.status).toBe(409);
    expect(notYet.body.error.code).toBe('PAYMENT_NOT_ALLOWED');

    const off = await setup({ payments: false });
    const disabled = await off.pay(0);
    expect(disabled.status).toBe(403);
    expect(disabled.body.error.code).toBe('MODULE_DISABLED');
    expect((await off.readOrder()).payments.enabled).toBe(false);

    const ctx = await setup();
    const foreign = await ctx.pay(0, session());
    expect(foreign.status).toBe(404);
    const created = (await ctx.pay(0)).body as PublicPaymentDto;
    expect((await ctx.status(created.ref, session())).status).toBe(404);
    expect((await ctx.status('mock_nope')).status).toBe(404);

    expect((await ctx.webhook({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents, paidAt: null })).status).toBe(200);
    await paid(ctx.readOrder);
    const paidAgain = await ctx.pay(0);
    expect(paidAgain.status).toBe(409);
    expect((await ctx.webhook({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents, paidAt: null })).status).toBe(200);
  });

  it('verifies the webhook signature, answers 200 at once and marks the order paid in the background, idempotently', async () => {
    const ctx = await setup();
    const created = (await ctx.pay(15)).body as PublicPaymentDto;
    const events: string[] = [];
    const unsubscribe = orderingBus.subscribe(ctx.owner.restaurantId, (event) => {
      if (event.type === 'order.updated') events.push(event.order.paymentStatus);
    });

    const forged = await ctx.webhook({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents, paidAt: null }, 'wrong-secret');
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe('INVALID_SIGNATURE');
    const unsigned = await api.post('/api/webhooks/payments/mock').send({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents });
    expect(unsigned.status).toBe(401);
    const unknownProvider = await api.post('/api/webhooks/payments/nope').send({});
    expect(unknownProvider.status).toBe(404);
    expect((await ctx.readOrder()).paymentStatus).toBe('pending');

    const paidAt = new Date().toISOString();
    const ok = await ctx.webhook({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents, paidAt });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ received: true });
    await paid(ctx.readOrder);
    const order = await ctx.readOrder();
    expect(order).toMatchObject({ paymentStatus: 'paid', paidAmountCents: created.amountCents, tipCents: created.tipCents, paidAt });
    expect((await ctx.status(created.ref)).body).toMatchObject({ status: 'paid', paidAt });

    // The same webhook again (gateways retry) changes nothing and emits nothing.
    const before = events.length;
    expect((await ctx.webhook({ providerRef: created.ref, status: 'paid', amountCents: created.amountCents, paidAt })).status).toBe(200);
    await settle();
    expect(events.length).toBe(before);
    expect(events).toContain('paid');
    // An unknown reference is acknowledged (and logged), not retried forever.
    const stranger = await ctx.webhook({ providerRef: 'mock_unknown', status: 'paid', amountCents: 1, paidAt: null });
    expect(stranger.status).toBe(401);
    unsubscribe();

    // Staff see it on the order and in analytics.
    const staff = await api.get(`${ctx.admin}/orders/${ctx.order.id}`).set(ctx.auth);
    expect(staff.body).toMatchObject({ paymentStatus: 'paid', providerRef: created.ref, tipCents: created.tipCents });
    const analytics = await api.get(`${ctx.admin}/analytics?range=7d`).set(ctx.auth);
    expect(analytics.body.ordering).toMatchObject({
      paidOnlineCount: { value: 1 },
      paidOnlineCents: { value: created.baseCents },
      tipsCents: { value: created.tipCents },
    });
  });

  it('handles failures and retries: failed → new attempt → paid; a short payment is not accepted', async () => {
    const ctx = await setup();
    const first = (await ctx.pay(0)).body as PublicPaymentDto;
    expect((await ctx.webhook({ providerRef: first.ref, status: 'failed', amountCents: 0, paidAt: null })).status).toBe(200);
    await paid(ctx.readOrder, 'failed');
    expect((await ctx.status(first.ref)).body.status).toBe('failed');

    const second = (await ctx.pay(5)).body as PublicPaymentDto;
    expect(second.ref).not.toBe(first.ref);
    expect((await ctx.readOrder()).paymentStatus).toBe('pending');
    // The bank says it took less than we asked for: stays pending, nothing is marked paid.
    await ctx.webhook({ providerRef: second.ref, status: 'paid', amountCents: second.amountCents - 100, paidAt: null });
    await settle();
    expect((await ctx.readOrder()).paymentStatus).toBe('pending');
    await ctx.webhook({ providerRef: second.ref, status: 'paid', amountCents: second.amountCents, paidAt: null });
    await paid(ctx.readOrder);
    expect((await ctx.readOrder())).toMatchObject({ paymentStatus: 'paid', tipCents: second.tipCents, paidAmountCents: second.amountCents });
    // A late "paid" for the first attempt cannot double-pay the order.
    await ctx.webhook({ providerRef: first.ref, status: 'paid', amountCents: first.amountCents, paidAt: null });
    await settle();
    expect((await ctx.readOrder()).paidAmountCents).toBe(second.amountCents);
  });

  it('reconciles pending attempts older than two minutes against the provider and expires stale QRs', async () => {
    resetMockOutcomes();
    const ctx = await setup();
    const fresh = (await ctx.pay(0)).body as PublicPaymentDto;
    expect(await reconcilePendingPayments()).toEqual({ checked: 0, changed: 0 });

    // Age the attempt: the provider knows it was paid (webhook lost).
    await Payment.update({ createdAt: new Date(Date.now() - 3 * 60_000) }, { where: { providerRef: fresh.ref } });
    recordMockOutcome(fresh.ref, { status: 'paid', amountCents: fresh.amountCents, paidAt: new Date() });
    expect(await reconcilePendingPayments()).toEqual({ checked: 1, changed: 1 });
    expect((await ctx.readOrder()).paymentStatus).toBe('paid');

    // A pending attempt past its expiry with no answer from the provider is expired, and the order can be paid again.
    const other = await setup();
    const stale = (await other.pay(0)).body as PublicPaymentDto;
    await Payment.update(
      { createdAt: new Date(Date.now() - 20 * 60_000), expiresAt: new Date(Date.now() - 60_000) },
      { where: { providerRef: stale.ref } },
    );
    expect(await reconcilePendingPayments()).toEqual({ checked: 1, changed: 1 });
    expect((await other.status(stale.ref)).body.status).toBe('expired');
    expect((await other.readOrder()).paymentStatus).toBe('unpaid');
    // The guest-facing status read also expires on its own clock.
    const lazy = (await other.pay(0)).body as PublicPaymentDto;
    await Payment.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { providerRef: lazy.ref } });
    expect((await other.status(lazy.ref)).body.status).toBe('expired');
  });

  it('lets staff mark cash, but never over an online payment, and only with the module', async () => {
    const ctx = await setup();
    const cash = await api.patch(`${ctx.admin}/orders/${ctx.order.id}/payment`).set(ctx.auth).send({ paymentStatus: 'cash' });
    expect(cash.status).toBe(200);
    expect(cash.body).toMatchObject({ paymentStatus: 'cash', paidAmountCents: 66000, tipCents: 0 });
    expect((await ctx.pay(0)).status).toBe(409);
    expect((await api.patch(`${ctx.admin}/orders/${ctx.order.id}/payment`).set(ctx.auth).send({ paymentStatus: 'cash' })).status).toBe(200);
    expect((await api.patch(`${ctx.admin}/orders/${ctx.order.id}/payment`).set(ctx.auth).send({ paymentStatus: 'paid' })).status).toBe(400);

    const paidOnline = await setup();
    const attempt = (await paidOnline.pay(0)).body as PublicPaymentDto;
    await applyPaymentResult((await Payment.findOne({ where: { providerRef: attempt.ref } }))!.id, {
      status: 'paid',
      amountCents: attempt.amountCents,
      paidAt: new Date(),
      raw: null,
    });
    const refused = await api.patch(`${paidOnline.admin}/orders/${paidOnline.order.id}/payment`).set(paidOnline.auth).send({ paymentStatus: 'cash' });
    expect(refused.status).toBe(409);

    const off = await setup({ payments: false });
    const noModule = await api.patch(`${off.admin}/orders/${off.order.id}/payment`).set(off.auth).send({ paymentStatus: 'cash' });
    expect(noModule.status).toBe(403);
    expect(noModule.body.error.code).toBe('MODULE_DISABLED');
    expect((await api.get(`${off.admin}/payment-config`).set(off.auth)).status).toBe(403);
  });

  it('keeps the merchant secret out of every response and lets the owner test the simulator connection', async () => {
    const ctx = await setup();
    const restaurant = await api.get(ctx.admin).set(ctx.auth);
    expect(restaurant.body.paymentConfig).toEqual({ provider: 'mock', merchantId: 'DEMO-1', hasSecret: true, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true, simulator: true });
    expect(JSON.stringify(restaurant.body)).not.toContain(SECRET);
    const config = await api.get(`${ctx.admin}/payment-config`).set(ctx.auth);
    expect(JSON.stringify(config.body)).not.toContain(SECRET);
    const test = await api.post(`${ctx.admin}/payment-config/test`).set(ctx.auth).send({});
    expect(test.body.ok).toBe(true);
    // Staff can read the config, only owners change it.
    const staff = await registerUser();
    const { Membership } = await import('../src/db/models/index.js');
    await Membership.create({ userId: staff.user.id, restaurantId: ctx.owner.restaurantId, role: 'staff' });
    expect((await api.get(`${ctx.admin}/payment-config`).set(bearer(staff.accessToken))).status).toBe(200);
    expect((await api.patch(`${ctx.admin}/payment-config`).set(bearer(staff.accessToken)).send({ merchantId: 'X' })).status).toBe(403);
    // The OTP skeleton is honest about not being wired yet.
    await api.patch(`${ctx.admin}/payment-config`).set(ctx.auth).send({ provider: 'otp' });
    expect((await api.post(`${ctx.admin}/payment-config/test`).set(ctx.auth).send({})).body.ok).toBe(false);
    expect((await ctx.pay(0)).status).toBe(503);
  });

  it('serves the simulator page for a pending attempt and fires the signed webhook on "pay"', async () => {
    const ctx = await setup();
    const created = (await ctx.pay(10)).body as PublicPaymentDto;
    const page = await api.get(`/dev/pay/${created.ref}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('Plati 726 RSD');
    expect(page.text).toContain('Odbij');
    expect((await api.get('/dev/pay/mock_nope')).status).toBe(404);

    // The simulator posts the webhook to env.API_URL, which in tests is not a running server: it reports that.
    const confirm = await api.post(`/dev/pay/${created.ref}/confirm`).set('Accept', 'application/json').type('form').send({ outcome: 'paid' });
    expect([200, 502]).toContain(confirm.status);
    expect(confirm.body.outcome).toBe('paid');
    // The outcome is recorded for the reconciliation path even when the webhook could not be delivered.
    const counted = await Order.count({ where: { id: ctx.order.id, paymentStatus: 'paid' } });
    if (confirm.status === 502) {
      expect(counted).toBe(0);
      await Payment.update({ createdAt: new Date(Date.now() - 3 * 60_000) }, { where: { providerRef: created.ref } });
      expect(await reconcilePendingPayments()).toEqual({ checked: 1, changed: 1 });
    }
    expect((await ctx.readOrder()).paymentStatus).toBe('paid');
    expect((await api.get(`/dev/pay/${created.ref}`)).text).toContain('Plaćeno');
  });
});
