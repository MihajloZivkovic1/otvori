import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { OrderDto, PublicOrderDto, PublicPaymentDto, TableDto } from '@qr-menu/shared';
import { env } from '../src/config/env.js';
import { User } from '../src/db/models/index.js';
import { MOCK_SIGNATURE_HEADER, signMockWebhook } from '../src/modules/payments/providers/mock.js';
import { settleBackgroundWork } from '../src/modules/payments/service.js';
import { octoposProvider } from '../src/modules/pos/providers/octopos.js';
import type { PosLine } from '../src/modules/pos/providers/types.js';
import { runDuePosJobs } from '../src/modules/pos/service.js';
import { outbox } from '../src/utils/mailer.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

/*
 * Live calls against the Octopos sandbox (tenant "Otvori.Menu"). Reads run whenever a key is in the environment
 * (apps/api/.env: OCTOPOS_API_URL + OCTOPOS_API_KEY, or the older OCTOPOS_SANDBOX_URL / OCTOPOS_SANDBOX_AUTH);
 * the writes (receipts, a table order) only with OCTOPOS_LIVE_WRITE=1, so a plain `npm test` never creates
 * sandbox bills. The key is never logged or asserted on.
 */

const baseUrl = env.OCTOPOS_API_URL ?? env.OCTOPOS_SANDBOX_URL;
const apiKey = env.OCTOPOS_API_KEY ?? env.OCTOPOS_SANDBOX_AUTH;
const live = Boolean(baseUrl && /^https?:\/\//.test(baseUrl) && apiKey);
const credentials = { baseUrl: baseUrl ?? null, apiKey: apiKey ?? null };
/** The sandbox PFR runs the test tax labels (F = 11 %); the production Ђ is refused there (docs/octopos.md). */
const SANDBOX_TAX_LABEL = 'F';
const WATER: PosLine = { productCode: '686', productName: 'ACQUA PANA 250 CL', groupName: null, taxLabel: SANDBOX_TAX_LABEL, unitPriceCents: 25000, quantity: 1, note: 'otvori test', createIfMissing: false };
const externalId = (suffix: string) => `otvori-dev-test-${Date.now()}-${suffix}`;

describe.skipIf(!live)('Octopos sandbox (live, reads)', () => {
  it('connects, lists products with codes, the active tables and the tax labels', { timeout: 60_000 }, async () => {
    const result = await octoposProvider.testConnection(credentials);
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/currency RSD/);
    const products = await octoposProvider.fetchProducts(credentials);
    expect(products.length).toBeGreaterThan(10);
    expect(products.find((p) => p.code === '686')).toMatchObject({ name: 'ACQUA PANA 250 CL', priceCents: 25000 });
    const tables = await octoposProvider.fetchTables(credentials);
    expect(tables.some((t) => t.name === '01')).toBe(true);
    const taxes = await octoposProvider.fetchTaxLabels(credentials);
    expect(taxes.map((t) => t.label)).toEqual(expect.arrayContaining(['Ђ', 'Е', SANDBOX_TAX_LABEL]));
    expect(await octoposProvider.testConnection({ baseUrl: credentials.baseUrl, apiKey: 'not-a-real-key' })).toMatchObject({ ok: false, message: 'The register rejected the API key' });
  });
});

describe.skipIf(!live || !env.OCTOPOS_LIVE_WRITE)('Octopos sandbox (live, writes — OCTOPOS_LIVE_WRITE=1)', () => {
  it('ESIR: issues a cash and an instant-payment receipt', { timeout: 60_000 }, async () => {
    const cash = await octoposProvider.createOrder({ externalId: externalId('cash'), lines: [WATER], note: 'otvori live test', tableName: null, payment: { kind: 'cash', amountCents: 25000 }, lineWidth: 40 }, credentials);
    expect(cash.receipt?.invoiceNumber).toMatch(/^[A-Z0-9]{8}-[A-Za-z0-9]{8}-\d+$/);
    expect(cash.receipt?.textTop).toContain('Готовина');
    expect(cash.receipt?.verificationUrl).toContain('sandbox.suf.purs.gov.rs');
    expect(cash.receipt?.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const instant = await octoposProvider.createOrder({ externalId: externalId('instant'), lines: [{ ...WATER, quantity: 2 }], note: null, tableName: null, payment: { kind: 'instant', amountCents: 50000 }, lineWidth: 40 }, credentials);
    expect(instant.receipt?.textTop).toContain('Инстант плаћање');
    expect(instant.receipt?.textTop).toContain('500,00');
  });

  it('POS: opens on table 03, reads it back, closes it by reissue and frees the table', { timeout: 90_000 }, async () => {
    const id = externalId('table');
    const opened = await octoposProvider.createOrder({ externalId: id, lines: [WATER], note: null, tableName: '03', payment: null, lineWidth: 40 }, credentials);
    expect(opened.receipt).toBeNull();
    expect(opened.posRef).toMatch(/^\d+$/);
    const open = await octoposProvider.getOrder(opened.posRef, credentials);
    expect(open).toMatchObject({ tableName: '03', occupied: true, revoked: false, lines: [{ productCode: '686', quantity: 1, unitPriceCents: 25000 }] });

    const closed = await octoposProvider.closeOrder(
      { externalId: id, receiptExternalId: `${id}-r`, posRef: opened.posRef, lines: [WATER], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'reissue', payPaymentTypeId: null, lineWidth: 40 },
      credentials,
    );
    expect(closed.receipt.textTop).toContain('Инстант плаћање');
    const after = await octoposProvider.getOrder(opened.posRef, credentials);
    expect(after?.occupied).toBe(false);
  });
});

/*
 * The whole chain through our API with the real sandbox as the register: order → accept → the payment simulator
 * pays (signed webhook) → the queue creates/closes the order in Octopos → fiscal data stored → PDF → e-mail (log
 * mailer). Tips stay out of the fiscal amount.
 */
const SECRET = 'live-merchant-secret';

async function liveVenue(mode: 'esir' | 'pos', tableName: string) {
  const owner = await registerUser({ restaurantName: `Octopos live ${mode}` });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const auth = bearer(owner.accessToken);
  const root = await registerUser({ restaurantName: 'HQ' });
  await User.update({ isSuperadmin: true }, { where: { id: root.user.id } });
  await api.patch(`/api/superadmin/restaurants/${owner.restaurantId}`).set(bearer(root.accessToken)).send({ modules: { ordering: true, payments: true, pos: true } });
  await api.patch(admin).set(auth).send({ orderingMode: 'order' });
  await api.patch(`${admin}/payment-config`).set(auth).send({ provider: 'mock', merchantId: 'LIVE', secret: SECRET, tipPresets: [0, 10], receiptEmailEnabled: true });
  const category = await createCategory(owner, { name: { sr: 'Voda' } });
  const water = await createItem(owner, { categoryId: category.id, name: { sr: 'Acqua Panna 0,25' }, priceCents: 25000, posProductCode: '686' });
  const table = (await api.post(`${admin}/tables`).set(auth).send({ number: 7, label: 'Bašta' })).body as TableDto;
  const config = await api
    .patch(`${admin}/pos-config`)
    .set(auth)
    .send({ provider: 'octopos', mode, baseUrl: baseUrl!.replace(/\/+$/, ''), apiKey, taxLabel: SANDBOX_TAX_LABEL, taxNumber: '112832835', tableMapping: { [table.id]: tableName }, sendOrdersToPos: mode === 'pos', closeOnPayment: true });
  expect(config.status, JSON.stringify(config.body)).toBe(200);
  expect((await api.post(`${admin}/pos-config/test`).set(auth).send({})).body).toMatchObject({ ok: true });
  await publish(owner);
  return { slug, admin, auth, water, guest: { 'X-Session-Id': randomUUID() } };
}

async function payThroughSimulator(v: Awaited<ReturnType<typeof liveVenue>>, orderId: string): Promise<PublicPaymentDto> {
  const payment = (await api.post(`/api/public/${v.slug}/orders/${orderId}/payments`).set(v.guest).send({ tipPercent: 10 })).body as PublicPaymentDto;
  const { json, signature } = signMockWebhook(SECRET, { providerRef: payment.ref, status: 'paid', amountCents: payment.amountCents, paidAt: new Date().toISOString() });
  expect((await api.post('/api/webhooks/payments/mock').set('Content-Type', 'application/json').set(MOCK_SIGNATURE_HEADER, signature).send(json)).status).toBe(200);
  await settleBackgroundWork();
  return payment;
}

async function expectReceiptDelivered(v: Awaited<ReturnType<typeof liveVenue>>, orderId: string, fiscalCents: string) {
  const staff = (await api.get(`${v.admin}/orders/${orderId}`).set(v.auth)).body as OrderDto;
  expect(staff, staff.fiscalError ?? '').toMatchObject({ paymentStatus: 'paid', fiscalStatus: 'issued' });
  expect(staff.fiscalInvoiceNumber).toMatch(/^[A-Z0-9]{8}-[A-Za-z0-9]{8}-\d+$/);
  expect(staff.fiscalVerificationUrl).toContain('sandbox.suf.purs.gov.rs');
  const guest = (await api.get(`/api/public/${v.slug}/orders/${orderId}`).set(v.guest)).body as PublicOrderDto;
  expect(guest.fiscalReceiptText).toContain('Инстант плаћање');
  expect(guest.fiscalReceiptText).toContain(fiscalCents);
  const pdf = await api.get(`/api/public/${v.slug}/orders/${orderId}/receipt.pdf`).set(v.guest);
  expect(pdf.status).toBe(200);
  expect(Buffer.from(pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await api.post(`/api/public/${v.slug}/orders/${orderId}/receipt-email`).set(v.guest).send({ email: 'gost@example.com' })).status).toBe(202);
  expect(outbox.at(-1)!.attachments?.[0]?.filename).toBe(`fiskalni-racun-${staff.fiscalInvoiceNumber}.pdf`);
  return staff;
}

describe.skipIf(!live || !env.OCTOPOS_LIVE_WRITE)('Octopos sandbox (live, end to end through the API — OCTOPOS_LIVE_WRITE=1)', () => {
  it('ESIR: accept → simulator pays with a 10 % tip → one fiscalised POST /WebOrder for the pre-tip amount → PDF → e-mail', { timeout: 120_000 }, async () => {
    const v = await liveVenue('esir', '05');
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.water.id, quantity: 2 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    expect(await runDuePosJobs()).toEqual({ ran: 0, failed: 0 });
    const payment = await payThroughSimulator(v, order.id);
    expect(payment.amountCents).toBe(55000);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    // 500,00 fiscalised (the 50,00 tip is not), the "Укупан износ" line of the receipt.
    await expectReceiptDelivered(v, order.id, '500,00');
    // A mapped code is sold without the create fields, so the register's product keeps its own name and group.
    const product = (await octoposProvider.fetchProducts(credentials)).find((p) => p.code === '686');
    expect(product).toMatchObject({ name: 'ACQUA PANA 250 CL', group: 'VODE' });
  });

  it('POS: accept opens the order on the till table → simulator pays → cancel + reissue with instant payment → table free', { timeout: 120_000 }, async () => {
    const v = await liveVenue('pos', '06');
    const order = (await api.post(`/api/public/${v.slug}/orders`).set(v.guest).send({ tableNumber: 7, items: [{ itemId: v.water.id, quantity: 1 }] })).body as PublicOrderDto;
    await api.patch(`${v.admin}/orders/${order.id}`).set(v.auth).send({ status: 'accepted' });
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    const opened = (await api.get(`${v.admin}/orders/${order.id}`).set(v.auth)).body as OrderDto;
    expect(opened.posRef).toMatch(/^\d+$/);
    const onTill = await octoposProvider.getOrder(opened.posRef!, credentials);
    expect(onTill).toMatchObject({ tableName: '06', occupied: true, lines: [{ productCode: '686', quantity: 1 }] });

    await payThroughSimulator(v, order.id);
    expect(await runDuePosJobs()).toEqual({ ran: 1, failed: 0 });
    const staff = await expectReceiptDelivered(v, order.id, '250,00');
    expect(staff.posRef).not.toBe(opened.posRef);
    expect((await octoposProvider.getOrder(opened.posRef!, credentials))?.occupied).toBe(false);
  });
});
