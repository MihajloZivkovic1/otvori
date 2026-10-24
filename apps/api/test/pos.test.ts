import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuItemDto, OrderDto, PosSyncPreviewDto, PublicOrderDto, PublicPaymentDto, TableDto } from '@qr-menu/shared';
import { env } from '../src/config/env.js';
import { Order, Payment, PosJob, User } from '../src/db/models/index.js';
import { orderingBus } from '../src/modules/ordering/events.js';
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from '../src/modules/payments/providers/mock.js';
import { settleBackgroundWork } from '../src/modules/payments/service.js';
import { mockPos } from '../src/modules/pos/providers/mock.js';
import { applyPaymentResult } from '../src/modules/payments/service.js';
import { authorizationHeader, octoposProvider } from '../src/modules/pos/providers/octopos.js';
import { runDuePosJobs } from '../src/modules/pos/service.js';
import { outbox } from '../src/utils/mailer.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/octopos/${name}.json`, import.meta.url), 'utf8')) as unknown;
const session = () => ({ 'X-Session-Id': randomUUID() });
const SECRET = 'demo-merchant-secret';

/* ------------------------------------------------------------------ OctoposProvider against recorded samples (fixture-only) */

describe('OctoposProvider (fixture-only: the public sandbox token cannot create receipts)', () => {
  const credentials = { baseUrl: 'https://sandbox.octopos.rs/api', apiKey: 'token123' };
  const calls: { url: string; init: RequestInit }[] = [];
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    calls.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(responses: Response[]) {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('unexpected call');
      return next;
    });
  }

  it('sends Basic auth (or a ready header value) and maps products: code, price in cents, group, tax, active', async () => {
    expect(authorizationHeader('abc')).toBe('Basic abc');
    expect(authorizationHeader('Bearer xyz')).toBe('Bearer xyz');
    stubFetch([answer(fixture('products'))]);
    const products = await octoposProvider.fetchProducts(credentials);
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/product');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Basic token123');
    // Products without a code are dropped; inactive ones are kept but flagged.
    expect(products.map((p) => p.code)).toEqual(['96', '53', 'ESP', 'RA.10004', '20']);
    expect(products.find((p) => p.code === 'ESP')).toEqual({ code: 'ESP', name: 'Espreso', group: 'Kafa', priceCents: 15000, taxLabel: '20%', active: true });
    expect(products.find((p) => p.code === '20')).toMatchObject({ priceCents: 14050, group: '#3', taxLabel: null, active: true });
    expect(products.find((p) => p.code === 'RA.10004')?.active).toBe(false);
  });

  it('opens an order on a table (TableName, no Payments) and reads the order id back', async () => {
    stubFetch([answer(fixture('create-order'))]);
    const order = { id: 'o1', note: 'bez šećera' } as never;
    const result = await octoposProvider.sendOrder(
      { order, externalId: 'otvori-dev-o1', tableName: '7', lines: [{ productCode: 'ESP', productName: 'Espreso', groupName: null, unitPriceCents: 15000, quantity: 2, note: null }] },
      credentials,
    );
    expect(result).toEqual({ posRef: '159851' });
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/weborder');
    expect(body).toEqual({
      TableName: '7',
      ExternalId: 'otvori-dev-o1',
      Info: 'bez šećera',
      Items: [{ ProductCode: 'ESP', ProductName: 'Espreso', GroupName: 'otvori', UnitMeasure: 'kom', TaxLabel: 'Ђ', Quantity: 2, Price: 150 }],
    });
    expect(body).not.toHaveProperty('Payments');
  });

  it('closes with FiscalPaymentTypeId 6 (instant) / 1 (cash), the same ExternalId by default, and parses the receipt', async () => {
    stubFetch([answer(fixture('create-receipt'))]);
    const order = { id: 'o1', note: null } as never;
    const lines = [{ productCode: 'T-001', productName: 'Coca Cola', groupName: 'Sokovi', unitPriceCents: 30000, quantity: 1, note: null }];
    const closed = await octoposProvider.closeOrder(
      { order, lines, externalId: 'otvori-dev-o1', payment: { kind: 'instant', amountCents: 30000 }, closeMode: 'reuse-external-id', openRef: '159851', printOnClose: false },
      credentials,
    );
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body.ExternalId).toBe('otvori-dev-o1');
    expect(body.Payments).toEqual([{ FiscalPaymentTypeId: 6, Amount: 300 }]);
    expect(body.FiscalReceiptData).toEqual({ ReturnTextualRepresentation: true, LineWidth: 40 });
    expect(closed.posRef).toBe('309484');
    expect(closed.receipt).toMatchObject({ invoiceNumber: '4RPVBTRZ-Dt1Ov1o0-146', verificationUrl: expect.stringContaining('sandbox.suf.purs.gov.rs') });
    expect(closed.receipt?.textTop).toContain('ФИСКАЛНИ РАЧУН');

    // new-receipt mode: a distinct ExternalId; cash → type 1; a numeric answer means "fetch the receipt separately".
    stubFetch([answer(fixture('create-order')), answer(fixture('fiscal-receipt'))]);
    const cash = await octoposProvider.closeOrder(
      { order, lines, externalId: 'otvori-dev-o1', payment: { kind: 'cash', amountCents: 30000 }, closeMode: 'new-receipt', openRef: '159851', printOnClose: false },
      credentials,
    );
    const body2 = JSON.parse(String(calls[1]!.init.body)) as Record<string, unknown>;
    expect(body2.ExternalId).toBe('otvori-dev-o1-close');
    expect(body2.Payments).toEqual([{ FiscalPaymentTypeId: 1, Amount: 300 }]);
    expect(calls[2]!.url).toBe('https://sandbox.octopos.rs/api/weborder/159851/fiscalreceipt?lineWidth=40');
    expect(cash.receipt?.invoiceNumber).toBe('4RPVBTRZ-Dt1Ov1o0-87');
  });

  it('reads an opened order back and resolves BillItems to product codes through the product list', async () => {
    stubFetch([answer(fixture('get-order')), answer(fixture('products'))]);
    const lines = await octoposProvider.getOrder('159851', credentials);
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/weborder/159851');
    expect(lines).toEqual([
      { productCode: 'ESP', productName: 'Espreso', quantity: 1, unitPriceCents: 15000 },
      { productCode: null, productName: 'Sprajt 0. 25l', quantity: 2, unitPriceCents: 12000 },
    ]);
    stubFetch([answer(fixture('error'), 400)]);
    expect(await octoposProvider.getOrder('nope', credentials)).toBeNull();
  });

  it('turns the register’s error envelope and auth failures into POS_UNAVAILABLE', async () => {
    stubFetch([answer(fixture('error'), 400)]);
    await expect(octoposProvider.fetchProducts(credentials)).rejects.toMatchObject({ code: 'POS_UNAVAILABLE', message: expect.stringContaining('Nevalidan sto') });
    stubFetch([new Response('', { status: 401 })]);
    await expect(octoposProvider.fetchProducts(credentials)).rejects.toMatchObject({ code: 'POS_UNAVAILABLE' });
    await expect(octoposProvider.fetchProducts({ baseUrl: null, apiKey: null })).rejects.toMatchObject({ status: 503 });
  });
});

/* ------------------------------------------------------------------ live sandbox (reads only; skipped without credentials) */

// The URL may still be the .env placeholder; the documented sandbox URL is the fallback.
const sandboxUrl = /^https?:\/\//.test(env.OCTOPOS_SANDBOX_URL ?? '') ? env.OCTOPOS_SANDBOX_URL! : 'https://sandbox.octopos.rs/api';
const live = Boolean(env.OCTOPOS_SANDBOX_AUTH);
describe.skipIf(!live)('Octopos sandbox (live, read-only)', () => {
  it('lists products with the credentials from the environment', { timeout: 60_000 }, async () => {
    const credentials = { baseUrl: sandboxUrl, apiKey: env.OCTOPOS_SANDBOX_AUTH! };
    const result = await octoposProvider.testConnection(credentials);
    expect(result.ok, result.message).toBe(true);
    const products = await octoposProvider.fetchProducts(credentials);
    expect(products.length).toBeGreaterThan(10);
    for (const product of products.slice(0, 20)) {
      expect(product.code).not.toBe('');
      expect(Number.isInteger(product.priceCents)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ end to end with the mock register */

async function venue({ sendOrders = true } = {}) {
  mockPos.reset();
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const auth = bearer(owner.accessToken);
  const root = await registerUser({ restaurantName: 'HQ' });
  await User.update({ isSuperadmin: true }, { where: { id: root.user.id } });
  await api.patch(`/api/superadmin/restaurants/${owner.restaurantId}`).set(bearer(root.accessToken)).send({ modules: { ordering: true, payments: true, pos: true } });
  await api.patch(admin).set(auth).send({ orderingMode: 'order' });
  await api.patch(`${admin}/payment-config`).set(auth).send({ provider: 'mock', merchantId: 'DEMO', secret: SECRET, tipPresets: [0, 10] });
  const category = await createCategory(owner, { name: { sr: 'Kafa' } });
  const espresso = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 18000, posProductCode: 'ESP' });
  const unmapped = await createItem(owner, { categoryId: category.id, name: { sr: 'Limunada' }, priceCents: 30000 });
  const table = (await api.post(`${admin}/tables`).set(auth).send({ number: 7, label: 'Bašta' })).body as TableDto;
  const pos = await api
    .patch(`${admin}/pos-config`)
    .set(auth)
    .send({ provider: 'mock', apiKey: 'demo-pos-key', tableMapping: { [table.id]: 'B1' }, sendOrdersToPos: sendOrders, closeOnPayment: true, closeMode: 'reuse-external-id' });
  expect(pos.status).toBe(200);
  expect(pos.body).toMatchObject({ provider: 'mock', hasApiKey: true, tableMapping: { [table.id]: 'B1' }, simulator: true });
  await publish(owner);
  const guest = session();
  return { owner, slug, admin, auth, category, espresso, unmapped, table, guest };
}

describe('POS integration (mock register)', () => {
  it('hides unmapped items from ordering while sendOrdersToPos is on, and the editor can map them', async () => {
    const v = await venue();
    const menu = await api.get(`/api/public/${v.slug}/menu`);
    const items = menu.body.categories[0].items as { id: string; isAvailable: boolean }[];
    expect(items.find((i) => i.id === v.espresso.id)?.isAvailable).toBe(true);
    expect(items.find((i) => i.id === v.unmapped.id)?.isAvailable).toBe(false);
    const refused = await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.unmapped.id, quantity: 1 }] });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('ITEM_UNAVAILABLE');

    const mapped = await api.patch(`${v.admin}/items/${v.unmapped.id}`).set(v.auth).send({ posProductCode: ' LIM ' });
    expect((mapped.body as MenuItemDto).posProductCode).toBe('LIM');
    expect((await api.get(`/api/public/${v.slug}/menu`)).body.categories[0].items.find((i: { id: string }) => i.id === v.unmapped.id).isAvailable).toBe(true);

    await api.patch(`${v.admin}/pos-config`).set(v.auth).send({ sendOrdersToPos: false });
    await api.patch(`${v.admin}/items/${v.unmapped.id}`).set(v.auth).send({ posProductCode: null });
    expect((await api.get(`/api/public/${v.slug}/menu`)).body.categories[0].items.find((i: { id: string }) => i.id === v.unmapped.id).isAvailable).toBe(true);
  });

  it('opens the order on the register when accepted, closes it with a fiscal receipt when the guest pays, and mails the receipt', async () => {
    const v = await venue();
    const events: OrderDto[] = [];
    const unsubscribe = orderingBus.subscribe(v.owner.restaurantId, (event) => {
      if (event.type === 'order.updated') events.push(event.order);
    });

    const created = await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 2, note: 'bez šećera' }] });
    expect(created.status).toBe(201);
    const order = created.body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    // Accepting queued "send_order"; the queue runs it.
    expect(await PosJob.count({ where: { orderId: order.id, type: 'send_order', status: 'queued' } })).toBe(1);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls()).toHaveLength(1);
    expect(mockPos.calls()[0]).toMatchObject({ type: 'send_order', tableName: 'B1', externalId: `otvori-dev-${order.id}` });
    expect(mockPos.calls()[0]!.lines).toEqual([{ productCode: 'ESP', productName: 'Espreso', groupName: null, unitPriceCents: 18000, quantity: 2, note: 'bez šećera' }]);
    expect((await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body.posRef).toBe('mock-order-1');

    // The guest pays with a tip through the simulator's signed webhook → close with the pre-tip amount.
    const payment = (await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(v.guest).send({ tipPercent: 10 })).body as PublicPaymentDto;
    expect(payment.amountCents).toBe(39600);
    const { json, signature } = signMockWebhook(SECRET, { providerRef: payment.ref, status: 'paid', amountCents: payment.amountCents, paidAt: new Date().toISOString() });
    expect((await api.post('/api/webhooks/payments/mock').set('Content-Type', 'application/json').set(MOCK_SIGNATURE_HEADER, signature).send(json)).status).toBe(200);
    await settleBackgroundWork();
    let staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ paymentStatus: 'paid', fiscalStatus: 'pending' });
    expect(await PosJob.count({ where: { orderId: order.id, type: 'close_order', status: 'queued' } })).toBe(1);

    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    const close = mockPos.calls()[1]!;
    expect(close).toMatchObject({ type: 'close_order', externalId: `otvori-dev-${order.id}`, amountCents: 36000, paymentKind: 'instant' });
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('issued');
    expect(staff.fiscalInvoiceNumber).toMatch(/^MOCKPFR0-MOCKPFR0-\d{3}$/);
    expect(staff.fiscalVerificationUrl).toContain('sandbox.suf.purs.gov.rs');
    expect(events.map((e) => e.fiscalStatus)).toContain('issued');
    unsubscribe();

    const mine = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(mine).toMatchObject({ fiscalStatus: 'issued', fiscalInvoiceNumber: staff.fiscalInvoiceNumber, fiscalVerificationUrl: staff.fiscalVerificationUrl });
    expect(mine.fiscalReceiptText).toContain('ФИСКАЛНИ РАЧУН');

    const mailed = await api.post(`/api/public/${v.slug}/orders/${order.id}/receipt-email`).set(v.guest).send({ email: 'gost@example.com' });
    expect(mailed.status).toBe(202);
    expect(outbox.at(-1)).toMatchObject({ to: 'gost@example.com', subject: expect.stringContaining(staff.fiscalInvoiceNumber!) });
    expect(outbox.at(-1)!.text).toContain(staff.fiscalVerificationUrl);
    expect((await api.post(`/api/public/${v.slug}/orders/${order.id}/receipt-email`).set(session()).send({ email: 'other@example.com' })).status).toBe(404);
  });

  it('retries failed register calls with backoff, gives up after the last delay, surfaces it on the order and lets staff retry', async () => {
    const v = await venue();
    const created = await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 1 }] });
    const order = created.body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    mockPos.failNextCalls(1);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    let job = (await PosJob.findOne({ where: { orderId: order.id, type: 'send_order' } }))!;
    expect(job).toMatchObject({ status: 'queued', attempts: 1, lastError: 'Mock register unreachable' });
    expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    // Not due yet …
    expect(await runDuePosJobs()).toEqual({ ran: 0, failed: 0 });
    // … but with the clock moved past the delay it runs and succeeds.
    expect(await runDuePosJobs(new Date(Date.now() + 31_000))).toEqual({ ran: 1, failed: 0 });
    job = (await PosJob.findOne({ where: { orderId: order.id, type: 'send_order' } }))!;
    expect(job.status).toBe('done');

    // Close: five failures in a row exhaust the schedule → failed + fiscalStatus failed with the error; the paid state is untouched.
    await Order.update({ paymentStatus: 'paid', paidAmountCents: 18000, paidAt: new Date() }, { where: { id: order.id } });
    await PosJob.create({ restaurantId: v.owner.restaurantId, orderId: order.id, type: 'close_order', payload: { amountCents: 18000, paymentKind: 'instant' } });
    await Order.update({ fiscalStatus: 'pending' }, { where: { id: order.id } });
    mockPos.failNextCalls(6);
    let at = Date.now();
    for (let attempt = 1; attempt <= 6; attempt++) {
      at += 3 * 3600_000;
      await runDuePosJobs(new Date(at));
    }
    job = (await PosJob.findOne({ where: { orderId: order.id, type: 'close_order' } }))!;
    expect(job).toMatchObject({ status: 'failed', attempts: 6 });
    let staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ paymentStatus: 'paid', fiscalStatus: 'failed', fiscalError: 'Mock register unreachable' });

    // Staff press Retry: queued again, next run succeeds.
    const retried = await api.post(`${v.admin}/orders/${order.id}/fiscal/retry`).set(v.auth).send({});
    expect(retried.status).toBe(200);
    expect((retried.body as OrderDto).fiscalStatus).toBe('pending');
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('issued');
  });

  it('previews a product sync (new codes, price changes, missing codes) and applies the reviewed rows', async () => {
    const v = await venue({ sendOrders: false });
    mockPos.setCatalogue([
      { code: 'ESP', name: 'Espresso', group: 'Kafa', priceCents: 19000, taxLabel: '20%', active: true },
      { code: 'CAP', name: 'Kapućino', group: 'Kafa', priceCents: 25000, taxLabel: '20%', active: true },
      { code: 'OLD', name: 'Stari', group: 'Arhiva', priceCents: 1000, taxLabel: '20%', active: false },
    ]);
    await api.patch(`${v.admin}/items/${v.unmapped.id}`).set(v.auth).send({ posProductCode: 'GONE' });
    const preview = (await api.get(`${v.admin}/pos/products`).set(v.auth)).body as PosSyncPreviewDto;
    expect(preview.create.map((p) => p.code)).toEqual(['CAP']);
    expect(preview.update).toEqual([{ itemId: v.espresso.id, code: 'ESP', name: 'Espreso', currentPriceCents: 18000, priceCents: 19000 }]);
    expect(preview.missing).toEqual([{ itemId: v.unmapped.id, code: 'GONE', name: 'Limunada' }]);
    expect(preview.unmapped).toBe(0);

    const applied = await api.post(`${v.admin}/pos/sync`).set(v.auth).send({ createCodes: ['CAP'], updateCodes: ['ESP'] });
    expect(applied.body).toMatchObject({ created: 1, updated: 1 });
    expect((await api.get(`${v.admin}/items/${v.espresso.id}`).set(v.auth)).body.priceCents).toBe(19000);
    const items = (await api.get(`${v.admin}/items`).set(v.auth)).body as MenuItemDto[];
    const imported = items.find((i) => i.posProductCode === 'CAP')!;
    expect(imported).toMatchObject({ name: { sr: 'Kapućino' }, priceCents: 25000, categoryId: applied.body.categoryId });
    const categories = (await api.get(`${v.admin}/categories`).set(v.auth)).body as { id: string; name: { sr: string }; isHidden: boolean }[];
    expect(categories.find((c) => c.id === applied.body.categoryId)).toMatchObject({ name: { sr: 'Sa kase' }, isHidden: true });
    // Applying again creates nothing new.
    expect((await api.post(`${v.admin}/pos/sync`).set(v.auth).send({ createCodes: ['CAP'] })).body).toMatchObject({ created: 0, updated: 0 });

    // Staff may not sync or change the config; without the module nothing is reachable.
    const staff = await registerUser();
    const { Membership } = await import('../src/db/models/index.js');
    await Membership.create({ userId: staff.user.id, restaurantId: v.owner.restaurantId, role: 'staff' });
    expect((await api.get(`${v.admin}/pos/products`).set(bearer(staff.accessToken))).status).toBe(403);
    // Phase 11: the configuration is owner-level (it is settings), reading included.
    expect((await api.get(`${v.admin}/pos-config`).set(bearer(staff.accessToken))).status).toBe(403);
    const plain = await registerUser();
    expect((await api.get(`/api/admin/restaurants/${plain.restaurantId}/pos-config`).set(bearer(plain.accessToken))).body.error.code).toBe('MODULE_DISABLED');
  });

  it('blocks online payment while the register holds items the app does not know (mixed orders), never a paid order\'s rejection, and accepts "issued at the register"', async () => {
    const v = await venue();
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 2 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    await runDuePosJobs();
    // Same lines on the register: payment allowed.
    const ok = await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(v.guest).send({ tipPercent: 0 });
    expect(ok.status).toBe(201);
    // The waiter types a second round at the register.
    mockPos.addLiveLines('mock-order-1', [{ productCode: 'LIM', productName: 'Limunada', quantity: 1, unitPriceCents: 30000 }]);
    const blocked = await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(v.guest).send({ tipPercent: 5 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('POS_MISMATCH');
    expect(blocked.body.error.details).toEqual({ extra: [{ productCode: 'LIM', productName: 'Limunada', quantity: 1, unitPriceCents: 30000 }], missing: [] });
    // Extra quantity of a known item counts too; an unreachable register does not block.
    mockPos.reset();
    const v2 = await venue();
    const o2 = (await api.post(`/api/public/${v2.slug}/orders`).set(v2.guest).send({ tableNumber: 7, items: [{ itemId: v2.espresso.id, quantity: 1 }] })).body as PublicOrderDto;
    await api.patch(`${v2.admin}/orders/${o2.id}`).set(v2.auth).send({ status: 'accepted' });
    await runDuePosJobs();
    mockPos.addLiveLines('mock-order-1', [{ productCode: 'ESP', productName: 'Espreso', quantity: 2, unitPriceCents: 18000 }]);
    const more = await api.post(`/api/public/${v2.slug}/orders/${o2.id}/payments`).set(v2.guest).send({});
    expect(more.body.error.details.extra).toEqual([{ productCode: 'ESP', productName: 'Espreso', quantity: 2, unitPriceCents: 18000 }]);

    // A paid order cannot be rejected; the refund happens at the register.
    const paidAttempt = (await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(session()).send({})).status; // foreign session: 404, unaffected
    expect(paidAttempt).toBe(404);
    await applyPaymentResult((await Payment.findOne({ where: { providerRef: ok.body.ref } }))!.id, { status: 'paid', amountCents: ok.body.amountCents, paidAt: new Date(), raw: null });
    const reject = await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'rejected', rejectedReason: 'x' });
    expect(reject.status).toBe(409);
    expect(reject.body.error.code).toBe('PAYMENT_NOT_ALLOWED');

    // The close job fails for good → the waiter issues the receipt by hand.
    await PosJob.update({ status: 'failed', lastError: 'boom' }, { where: { orderId: order.id, type: 'close_order' } });
    await Order.update({ fiscalStatus: 'failed', fiscalError: 'boom' }, { where: { id: order.id } });
    const manual = await api.post(`${v.admin}/orders/${order.id}/fiscal/manual`).set(v.auth).send({});
    expect(manual.status).toBe(200);
    expect((manual.body as OrderDto).fiscalStatus).toBe('manual');
    expect(await PosJob.count({ where: { orderId: order.id, type: 'close_order', status: 'done' } })).toBe(1);
    expect(await runDuePosJobs()).toEqual({ ran: 0, failed: 0 });
    const guest = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(guest.fiscalStatus).toBe('manual');
    expect(guest.fiscalInvoiceNumber).toBeNull();
  });

  it('never leaks the API key and reports the mock connection', async () => {
    const v = await venue();
    const restaurant = await api.get(v.admin).set(v.auth);
    expect(JSON.stringify(restaurant.body)).not.toContain('demo-pos-key');
    expect(restaurant.body.posConfig).toMatchObject({ provider: 'mock', hasApiKey: true, sendOrdersToPos: true, closeOnPayment: true, closeMode: 'reuse-external-id' });
    expect((await api.post(`${v.admin}/pos-config/test`).set(v.auth).send({})).body).toMatchObject({ ok: true });
  });
});
