import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { MenuItemDto, OrderDto, PosConfigDto, PosSyncPreviewDto, PosTableDto, PosTaxLabelDto, PublicOrderDto, PublicPaymentDto, TableDto } from '@qr-menu/shared';
import { Order, Payment, PosJob, User } from '../src/db/models/index.js';
import { orderingBus } from '../src/modules/ordering/events.js';
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from '../src/modules/payments/providers/mock.js';
import { applyPaymentResult, settleBackgroundWork } from '../src/modules/payments/service.js';
import { mockPos } from '../src/modules/pos/providers/mock.js';
import { generatedProductCode, runDuePosJobs } from '../src/modules/pos/service.js';
import { outbox } from '../src/utils/mailer.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

/*
 * The whole flow with the mock register (POS_MOCK=true): order → accept → simulator pays → webhook → Octopos
 * create/close → fiscal data → PDF → e-mail, in both modes. The Octopos provider itself is covered by
 * test/octopos-client.test.ts (sandbox recordings) and test/octopos-live.test.ts.
 */

const session = () => ({ 'X-Session-Id': randomUUID() });
const SECRET = 'demo-merchant-secret';

async function venue({ mode = 'pos' as 'pos' | 'esir', sendOrders = true, mapEspresso = true } = {}) {
  mockPos.reset();
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const auth = bearer(owner.accessToken);
  const root = await registerUser({ restaurantName: 'HQ' });
  await User.update({ isSuperadmin: true }, { where: { id: root.user.id } });
  await api.patch(`/api/superadmin/restaurants/${owner.restaurantId}`).set(bearer(root.accessToken)).send({ modules: { ordering: true, payments: true, pos: true } });
  await api.patch(admin).set(auth).send({ orderingMode: 'order' });
  await api.patch(`${admin}/payment-config`).set(auth).send({ provider: 'mock', merchantId: 'DEMO', secret: SECRET, tipPresets: [0, 10], receiptEmailEnabled: true });
  const category = await createCategory(owner, { name: { sr: 'Kafa' } });
  const espresso = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 18000, ...(mapEspresso ? { posProductCode: 'ESP' } : {}) });
  const unmapped = await createItem(owner, { categoryId: category.id, name: { sr: 'Limunada' }, priceCents: 30000 });
  const table = (await api.post(`${admin}/tables`).set(auth).send({ number: 7, label: 'Bašta' })).body as TableDto;
  const pos = await api
    .patch(`${admin}/pos-config`)
    .set(auth)
    .send({ provider: 'mock', mode, apiKey: 'demo-pos-key', taxNumber: '112832835', tableMapping: { [table.id]: 'B1' }, sendOrdersToPos: sendOrders, closeOnPayment: true });
  expect(pos.status).toBe(200);
  expect(pos.body).toMatchObject({ provider: 'mock', mode, hasApiKey: true, taxLabel: 'Ђ', taxNumber: '112832835', closeStrategy: 'reissue', payPaymentTypeId: null, simulator: true });
  await publish(owner);
  const guest = session();
  return { owner, slug, admin, auth, category, espresso, unmapped, table, guest };
}

async function payOnline(v: Awaited<ReturnType<typeof venue>>, orderId: string, tipPercent = 10): Promise<PublicPaymentDto> {
  const payment = (await api.post(`/api/public/${v.slug}/orders/${orderId}/payments`).set(v.guest).send({ tipPercent })).body as PublicPaymentDto;
  const { json, signature } = signMockWebhook(SECRET, { providerRef: payment.ref, status: 'paid', amountCents: payment.amountCents, paidAt: new Date().toISOString() });
  expect((await api.post('/api/webhooks/payments/mock').set('Content-Type', 'application/json').set(MOCK_SIGNATURE_HEADER, signature).send(json)).status).toBe(200);
  await settleBackgroundWork();
  return payment;
}

describe('POS mode (the venue’s own till, mock register)', () => {
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

  it('opens the order on the register when accepted, closes it by cancel + reissue when the guest pays, stores the receipt, serves the PDF and mails it', async () => {
    const v = await venue();
    const events: OrderDto[] = [];
    const unsubscribe = orderingBus.subscribe(v.owner.restaurantId, (event) => {
      if (event.type === 'order.updated') events.push(event.order);
    });

    const created = await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 2, note: 'bez šećera' }] });
    expect(created.status).toBe(201);
    const order = created.body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    expect(await PosJob.count({ where: { orderId: order.id, type: 'send_order', status: 'queued' } })).toBe(1);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls()).toHaveLength(1);
    expect(mockPos.calls()[0]).toMatchObject({ type: 'create_order', tableName: 'B1', externalId: `otvori-dev-${order.id}` });
    expect(mockPos.calls()[0]!.lines).toEqual([{ productCode: 'ESP', productName: 'Espreso', groupName: null, taxLabel: 'Ђ', unitPriceCents: 18000, quantity: 2, note: 'bez šećera', createIfMissing: false }]);
    expect((await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body.posRef).toBe('mock-order-1');

    // The guest pays with a tip through the simulator's signed webhook → fiscalise the pre-tip amount.
    const payment = await payOnline(v, order.id, 10);
    expect(payment.amountCents).toBe(39600);
    let staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ paymentStatus: 'paid', fiscalStatus: 'pending' });
    expect(await PosJob.count({ where: { orderId: order.id, type: 'close_order', status: 'queued' } })).toBe(1);

    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls().map((c) => c.type)).toEqual(['create_order', 'cancel_order', 'close_order']);
    expect(mockPos.calls()[1]).toMatchObject({ type: 'cancel_order', externalId: `otvori-dev-${order.id}` });
    expect(mockPos.calls()[2]).toMatchObject({ type: 'close_order', externalId: `otvori-dev-${order.id}-r`, amountCents: 36000, paymentKind: 'instant', strategy: 'reissue' });
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('issued');
    expect(staff.fiscalInvoiceNumber).toMatch(/^MOCKPFR0-MOCKPFR0-\d{3}$/);
    expect(staff.fiscalVerificationUrl).toContain('sandbox.suf.purs.gov.rs');
    expect(staff.fiscalIssuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(events.map((e) => e.fiscalStatus)).toContain('issued');
    unsubscribe();

    const mine = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(mine).toMatchObject({ fiscalStatus: 'issued', fiscalInvoiceNumber: staff.fiscalInvoiceNumber, fiscalVerificationUrl: staff.fiscalVerificationUrl, fiscalIssuedAt: staff.fiscalIssuedAt });
    expect(mine.fiscalReceiptText).toContain('ФИСКАЛНИ РАЧУН');
    expect(mine.fiscalReceiptText).toContain('Инстант плаћање');

    // The PDF: session-bound (header or ?s=), a real PDF, named after the invoice.
    const pdf = await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf`).set(v.guest);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdf.headers['content-disposition']).toBe(`inline; filename="fiskalni-racun-${staff.fiscalInvoiceNumber}.pdf"`);
    expect(Buffer.from(pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const viaQuery = await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf?s=${v.guest['X-Session-Id']}`);
    expect(viaQuery.status).toBe(200);
    expect((await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf`).set(session())).status).toBe(404);
    expect((await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf`)).status).toBe(400);

    // Mail: the PDF attached, the text and the verification link in the body.
    const mailed = await api.post(`/api/public/${v.slug}/orders/${order.id}/receipt-email`).set(v.guest).send({ email: 'gost@example.com' });
    expect(mailed.status).toBe(202);
    const mail = outbox.at(-1)!;
    expect(mail).toMatchObject({ to: 'gost@example.com', subject: expect.stringContaining(staff.fiscalInvoiceNumber!) });
    expect(mail.text).toContain(staff.fiscalVerificationUrl);
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments![0]).toMatchObject({ filename: `fiskalni-racun-${staff.fiscalInvoiceNumber}.pdf`, contentType: 'application/pdf' });
    expect(mail.attachments![0]!.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await api.post(`/api/public/${v.slug}/orders/${order.id}/receipt-email`).set(session()).send({ email: 'other@example.com' })).status).toBe(404);
  });

  it('refuses the PDF and the mail before a receipt exists, and the table block never reaches the register', async () => {
    const v = await venue({ sendOrders: false });
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 1 }] })).body as PublicOrderDto;
    expect((await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf`).set(v.guest)).body.error.code).toBe('PAYMENT_NOT_ALLOWED');
    expect((await api.post(`/api/public/${v.slug}/orders/${order.id}/receipt-email`).set(v.guest).send({ email: 'a@b.co' })).status).toBe(409);
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    expect(await PosJob.count({ where: { orderId: order.id } })).toBe(0);
    // Without an opened order the close is a single fiscalised create (no cancel).
    await payOnline(v, order.id, 0);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls().map((c) => c.type)).toEqual(['create_order']);
    expect(mockPos.calls()[0]).toMatchObject({ externalId: `otvori-dev-${order.id}`, paymentKind: 'instant', amountCents: 18000, tableName: null });
  });

  it('retries network failures with backoff, gives up after the last delay, fails a refusal at once, and lets staff retry', async () => {
    const v = await venue();
    const created = await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 1 }] });
    const order = created.body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    mockPos.failNextCalls(1);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    let job = (await PosJob.findOne({ where: { orderId: order.id, type: 'send_order' } }))!;
    expect(job).toMatchObject({ status: 'queued', attempts: 1, lastError: 'Mock register unreachable' });
    expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    expect(await runDuePosJobs()).toEqual({ ran: 0, failed: 0 });
    expect(await runDuePosJobs(new Date(Date.now() + 31_000))).toEqual({ ran: 1, failed: 0 });
    job = (await PosJob.findOne({ where: { orderId: order.id, type: 'send_order' } }))!;
    expect(job.status).toBe('done');

    // Close: five network failures exhaust the schedule → failed + fiscalStatus failed; the paid state is untouched.
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

    // Staff press Retry; this time the register refuses the request (validation) → failed immediately, no backoff.
    const retried = await api.post(`${v.admin}/orders/${order.id}/fiscal/retry`).set(v.auth).send({});
    expect(retried.status).toBe(200);
    expect((retried.body as OrderDto).fiscalStatus).toBe('pending');
    mockPos.rejectNextCall('items[0].labels[0]: Neispravne poreske stope');
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 1 });
    job = (await PosJob.findOne({ where: { orderId: order.id, type: 'close_order' } }))!;
    expect(job).toMatchObject({ status: 'failed', attempts: 1 });
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ fiscalStatus: 'failed', fiscalError: 'The register refused the request: items[0].labels[0]: Neispravne poreske stope' });

    // Retry again: succeeds.
    await api.post(`${v.admin}/orders/${order.id}/fiscal/retry`).set(v.auth).send({});
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('issued');
  });

  it('previews a product sync (new codes, price changes, missing codes), applies the reviewed rows, lists tables and tax labels', async () => {
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
    expect((await api.post(`${v.admin}/pos/sync`).set(v.auth).send({ createCodes: ['CAP'] })).body).toMatchObject({ created: 0, updated: 0 });

    const tables = (await api.get(`${v.admin}/pos/tables`).set(v.auth)).body as PosTableDto[];
    expect(tables).toEqual([
      { id: 1, name: '01' },
      { id: 2, name: '02' },
      { id: 3, name: 'B1' },
      { id: 4, name: 'B2' },
    ]);
    const taxes = (await api.get(`${v.admin}/pos/taxes`).set(v.auth)).body as PosTaxLabelDto[];
    expect(taxes.map((t) => t.label)).toEqual(['Ђ', 'Е', 'Г']);

    // Staff may not sync or change the config; without the module nothing is reachable.
    const staff = await registerUser();
    const { Membership } = await import('../src/db/models/index.js');
    await Membership.create({ userId: staff.user.id, restaurantId: v.owner.restaurantId, role: 'staff' });
    expect((await api.get(`${v.admin}/pos/products`).set(bearer(staff.accessToken))).status).toBe(403);
    expect((await api.get(`${v.admin}/pos/tables`).set(bearer(staff.accessToken))).status).toBe(403);
    expect((await api.get(`${v.admin}/pos-config`).set(bearer(staff.accessToken))).status).toBe(403);
    const plain = await registerUser();
    expect((await api.get(`/api/admin/restaurants/${plain.restaurantId}/pos-config`).set(bearer(plain.accessToken))).body.error.code).toBe('MODULE_DISABLED');
  });

  it('blocks online payment while the register holds items the app does not know (mixed orders), never a paid order’s rejection, and accepts "issued at the register"', async () => {
    const v = await venue();
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 2 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    await runDuePosJobs();
    const ok = await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(v.guest).send({ tipPercent: 0 });
    expect(ok.status).toBe(201);
    mockPos.addLiveLines('mock-order-1', [{ productCode: 'LIM', productName: 'Limunada', quantity: 1, unitPriceCents: 30000 }]);
    const blocked = await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(v.guest).send({ tipPercent: 5 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('POS_MISMATCH');
    expect(blocked.body.error.details).toEqual({ extra: [{ productCode: 'LIM', productName: 'Limunada', quantity: 1, unitPriceCents: 30000 }], missing: [] });
    mockPos.reset();
    const v2 = await venue();
    const o2 = (await api.post(`/api/public/${v2.slug}/orders`).set(v2.guest).send({ tableNumber: 7, items: [{ itemId: v2.espresso.id, quantity: 1 }] })).body as PublicOrderDto;
    await api.patch(`${v2.admin}/orders/${o2.id}`).set(v2.auth).send({ status: 'accepted' });
    await runDuePosJobs();
    mockPos.addLiveLines('mock-order-1', [{ productCode: 'ESP', productName: 'Espreso', quantity: 2, unitPriceCents: 18000 }]);
    const more = await api.post(`/api/public/${v2.slug}/orders/${o2.id}/payments`).set(v2.guest).send({});
    expect(more.body.error.details.extra).toEqual([{ productCode: 'ESP', productName: 'Espreso', quantity: 2, unitPriceCents: 18000 }]);

    expect((await api.post(`/api/public/${v.slug}/orders/${order.id}/payments`).set(session()).send({})).status).toBe(404);
    await applyPaymentResult((await Payment.findOne({ where: { providerRef: ok.body.ref } }))!.id, { status: 'paid', amountCents: ok.body.amountCents, paidAt: new Date(), raw: null });
    const reject = await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'rejected', rejectedReason: 'x' });
    expect(reject.status).toBe(409);
    expect(reject.body.error.code).toBe('PAYMENT_NOT_ALLOWED');

    // The waiter closed the table at the till in the meantime: the close must not fiscalise twice.
    mockPos.closeAtTill('mock-order-1');
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 1 });
    let staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ fiscalStatus: 'failed', fiscalError: 'The register already closed this order at the till; the receipt was issued there' });
    const manual = await api.post(`${v.admin}/orders/${order.id}/fiscal/manual`).set(v.auth).send({});
    expect(manual.status).toBe(200);
    expect((manual.body as OrderDto).fiscalStatus).toBe('manual');
    expect(await PosJob.count({ where: { orderId: order.id, type: 'close_order', status: 'done' } })).toBe(1);
    expect(await runDuePosJobs()).toEqual({ ran: 0, failed: 0 });
    const guest = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(guest.fiscalStatus).toBe('manual');
    expect(guest.fiscalInvoiceNumber).toBeNull();
    staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('manual');
  });

  it('never leaks the API key, reports the mock connection, and keeps dropped options out of the DTO', async () => {
    const v = await venue();
    const restaurant = await api.get(v.admin).set(v.auth);
    expect(JSON.stringify(restaurant.body)).not.toContain('demo-pos-key');
    const config = restaurant.body.posConfig as PosConfigDto;
    expect(config).toMatchObject({ provider: 'mock', mode: 'pos', hasApiKey: true, sendOrdersToPos: true, closeOnPayment: true, closeStrategy: 'reissue' });
    expect(config).not.toHaveProperty('closeMode');
    expect(config).not.toHaveProperty('printOnClose');
    expect((await api.post(`${v.admin}/pos-config/test`).set(v.auth).send({})).body).toMatchObject({ ok: true, message: expect.stringContaining('Mock register ready') });
    // The old shape is refused (strict-ish: unknown keys are ignored by the partial schema, wrong values are not).
    expect((await api.patch(`${v.admin}/pos-config`).set(v.auth).send({ mode: 'till' })).status).toBe(400);
    expect((await api.patch(`${v.admin}/pos-config`).set(v.auth).send({ closeStrategy: 'pay', payPaymentTypeId: 3 })).body).toMatchObject({ closeStrategy: 'pay', payPaymentTypeId: 3 });
  });
});

describe('ESIR mode (Octopos fiscalises for the venue, mock register)', () => {
  it('never opens orders on a table, fiscalises an online payment in one call, and gives unmapped items a generated code', async () => {
    const v = await venue({ mode: 'esir', sendOrders: true, mapEspresso: false });
    // ESIR mode has no till: "send orders" is forced off and unmapped items stay orderable.
    expect((await api.get(`${v.admin}/pos-config`).set(v.auth)).body).toMatchObject({ mode: 'esir', sendOrdersToPos: false });
    const menu = await api.get(`/api/public/${v.slug}/menu`);
    expect((menu.body.categories[0].items as { isAvailable: boolean }[]).every((i) => i.isAvailable)).toBe(true);

    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 1 }, { itemId: v.unmapped.id, quantity: 2 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    expect(await PosJob.count({ where: { orderId: order.id } })).toBe(0);
    expect(mockPos.calls()).toHaveLength(0);

    const payment = await payOnline(v, order.id, 10);
    expect(payment.amountCents).toBe(85800);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls()).toHaveLength(1);
    const call = mockPos.calls()[0]!;
    expect(call).toMatchObject({ type: 'create_order', tableName: null, externalId: `otvori-dev-${order.id}`, paymentKind: 'instant', amountCents: 78000 });
    expect(call.lines).toEqual([
      { productCode: generatedProductCode(v.espresso.id), productName: 'Espreso', groupName: null, taxLabel: 'Ђ', unitPriceCents: 18000, quantity: 1, note: null, createIfMissing: true },
      { productCode: generatedProductCode(v.unmapped.id), productName: 'Limunada', groupName: null, taxLabel: 'Ђ', unitPriceCents: 30000, quantity: 2, note: null, createIfMissing: true },
    ]);
    expect(generatedProductCode(v.espresso.id)).toMatch(/^OTV-[0-9A-F]{10}$/);
    const staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff).toMatchObject({ fiscalStatus: 'issued', posRef: 'mock-order-1' });
    const guest = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(guest.fiscalReceiptText).toContain('Инстант плаћање:                  780,00');
    expect((await api.get(`/api/public/${v.slug}/orders/${order.id}/receipt.pdf`).set(v.guest)).status).toBe(200);
  });

  it('fiscalises cash too (staff mark "Cash", there is no till to do it), with the venue’s tax label', async () => {
    const v = await venue({ mode: 'esir' });
    await api.patch(`${v.admin}/pos-config`).set(v.auth).send({ taxLabel: 'Е' });
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.espresso.id, quantity: 3 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    const cash = await api.patch(`${v.admin}/orders/${order.id}/payment`).set(v.auth).send({ paymentStatus: 'cash' });
    expect(cash.status).toBe(200);
    expect((cash.body as OrderDto).paymentStatus).toBe('cash');
    expect((await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body.fiscalStatus).toBe('pending');
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    expect(mockPos.calls()[0]).toMatchObject({ type: 'create_order', paymentKind: 'cash', amountCents: 54000 });
    expect(mockPos.calls()[0]!.lines[0]).toMatchObject({ productCode: 'ESP', taxLabel: 'Е', createIfMissing: false });
    const staff = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(staff.fiscalStatus).toBe('issued');
    const guest = (await api.get(`/api/public/${v.slug}/orders/${order.id}`).set(v.guest)).body as PublicOrderDto;
    expect(guest.fiscalReceiptText).toContain('Готовина:                         540,00');

    // In POS mode cash is handled at the till: nothing is queued.
    mockPos.reset();
    const till = await venue({ mode: 'pos' });
    const o2 = (await api.post(`/api/public/${till.slug}/orders`).set(till.guest).send({ tableNumber: 7, items: [{ itemId: till.espresso.id, quantity: 1 }] })).body as PublicOrderDto;
    await api.patch(`${till.admin}/orders/${o2.id}`).set(till.auth).send({ status: 'accepted' });
    await api.patch(`${till.admin}/orders/${o2.id}/payment`).set(till.auth).send({ paymentStatus: 'cash' });
    expect(await PosJob.count({ where: { orderId: o2.id, type: 'close_order' } })).toBe(0);
    expect((await api.get(`${till.admin}/orders/${o2.id}`).set(till.auth)).body.fiscalStatus).toBe('none');
  });
});
