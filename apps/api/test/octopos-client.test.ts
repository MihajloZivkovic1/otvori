import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OctoposClient, OctoposError, authorizationHeader } from '../src/modules/pos/providers/octopos/client.js';
import { octoposProvider, toItems } from '../src/modules/pos/providers/octopos.js';
import { PosProviderError, type PosLine } from '../src/modules/pos/providers/types.js';
import { z } from 'zod';

/*
 * The Octopos client and provider against the request/response pairs recorded on the sandbox on 2026-10-26
 * (test/fixtures/octopos/*.json, written by the probes described in docs/octopos.md). No network here; the live
 * suite is test/octopos-live.test.ts.
 */

interface Fixture {
  request: { method: string; path: string; body?: unknown };
  response: { status: number; body: unknown };
}
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/octopos/${name}.json`, import.meta.url), 'utf8')) as Fixture;
const credentials = { baseUrl: 'https://sandbox.octopos.rs/api/', apiKey: 'token123' };
const calls: { url: string; init: RequestInit }[] = [];

function answer(fx: Fixture): Response {
  const body = fx.response.body;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: fx.response.status,
    headers: typeof body === 'string' ? {} : { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function stubFetch(responses: (Response | Error)[]) {
  calls.length = 0;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected call ${init.method} ${url}`);
    if (next instanceof Error) throw next;
    return next;
  });
}

const sent = (index = 0) => JSON.parse(String(calls[index]!.init.body)) as Record<string, unknown>;
const line = (over: Partial<PosLine> = {}): PosLine => ({ productCode: '686', productName: 'ACQUA PANA 250 CL', groupName: null, taxLabel: 'F', unitPriceCents: 25000, quantity: 1, note: null, createIfMissing: false, ...over });

beforeEach(() => {
  calls.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OctoposClient', () => {
  it('sends the key as Basic (or a ready header value), fills path params and query, and unwraps the envelope', async () => {
    expect(authorizationHeader('abc')).toBe('Basic abc');
    expect(authorizationHeader('Bearer xyz')).toBe('Bearer xyz');
    stubFetch([answer(fixture('weborder-fiscalreceipt'))]);
    const client = new OctoposClient({ ...credentials });
    const data = await client.call('WebOrder_GetFiscalReceipt', { pathParams: { id: 66868 }, query: { lineWidth: 40 } }, z.object({ InvoiceNumber: z.string() }));
    expect(data.InvoiceNumber).toBe('SEU257EZ-Dt1Ov2o0-10369');
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/WebOrder/66868/FiscalReceipt?lineWidth=40');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Basic token123');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('maps 401 to a non-retryable auth error (the sandbox answers 401 with an empty body)', async () => {
    stubFetch([answer(fixture('error-401'))]);
    const client = new OctoposClient(credentials);
    const error = await client.call('WebOrder_Post', { body: { Items: [] } }, z.unknown()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OctoposError);
    expect(error).toMatchObject({ kind: 'auth', retryable: false, status: 401 });
  });

  it('maps the register’s refusals (unknown product, amounts, table, no items) to non-retryable "rejected" with the reason', async () => {
    const cases: [string, string | null][] = [
      ['error-unknown-product', 'unknownProduct'],
      ['error-amount', 'amountMismatch'],
      ['error-table', 'invalidTable'],
      ['error-empty', null],
      ['weborder-newcode-rejected', 'invalidTaxLabel'],
      ['weborder-duplicate-external-id', 'duplicateExternalId'],
      ['weborder-pay-again-error', 'alreadyClosed'],
    ];
    for (const [name, reason] of cases) {
      stubFetch([answer(fixture(name))]);
      const error = (await new OctoposClient(credentials).call('WebOrder_Post', { body: {} }, z.unknown()).catch((e: unknown) => e)) as OctoposError;
      expect(error, name).toBeInstanceOf(OctoposError);
      expect(error.kind, name).toBe('rejected');
      expect(error.retryable, name).toBe(false);
      expect(error.reason, name).toBe(reason);
      expect(error.message, name).toMatch(/^The register refused the request: /);
    }
    // "Resource not found" is its own kind so callers can treat it as "already gone".
    stubFetch([answer(fixture('weborder-cancel-unknown'))]);
    const gone = (await new OctoposClient(credentials).call('WebOrder_CancelWebOrder', { pathParams: { externalId: 'x' } }, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(gone).toMatchObject({ kind: 'not_found', retryable: false, reason: 'notFound' });
  });

  it('treats handler crashes, 5xx text and 404 { Message } as server / not-found errors, keeps the first line of a stack trace', async () => {
    stubFetch([answer(fixture('weborder-pay-bill-id-error'))]);
    const crash = (await new OctoposClient(credentials).call('WebOrder_PayTableBill', { pathParams: { id: 66871 }, body: {} }, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(crash).toMatchObject({ kind: 'server', retryable: true });
    expect(crash.message).toBe('The register refused the request: Server error; System.NullReferenceException: Object reference not set to an instance of an object.');
    expect(crash.errors).toHaveLength(2);

    stubFetch([new Response('An error occurred, please try again or contact the administrator.', { status: 500 })]);
    const text = (await new OctoposClient(credentials).call('Ping_Get', {}, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(text).toMatchObject({ kind: 'server', retryable: true, status: 500 });

    stubFetch([new Response(JSON.stringify({ Message: "No HTTP resource was found that matches the request URI 'https://sandbox.octopos.rs/api/Nope'." }), { status: 404 })]);
    const missing = (await new OctoposClient(credentials).call('Ping_Get', {}, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(missing).toMatchObject({ kind: 'not_found', retryable: false });
    expect(missing.message).toMatch(/No HTTP resource/);
  });

  it('maps a timeout and a network failure to retryable errors', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    stubFetch([timeout]);
    const slow = (await new OctoposClient({ ...credentials, timeoutMs: 5_000 }).call('Ping_Get', {}, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(slow).toMatchObject({ kind: 'timeout', retryable: true });
    expect(slow.message).toBe('The register did not answer within 5 s');

    stubFetch([new TypeError('fetch failed')]);
    const down = (await new OctoposClient(credentials).call('Ping_Get', {}, z.unknown()).catch((e: unknown) => e)) as OctoposError;
    expect(down).toMatchObject({ kind: 'unreachable', retryable: true });
  });

  it('refuses answers that do not match the schema', async () => {
    stubFetch([answer(fixture('ping'))]);
    const bad = (await new OctoposClient(credentials).call('Ping_Get', {}, z.object({ Nope: z.string() })).catch((e: unknown) => e)) as OctoposError;
    expect(bad).toMatchObject({ kind: 'shape', retryable: false });
  });
});

describe('OctoposProvider (sandbox recordings)', () => {
  it('tests the connection through an authenticated call (currency) and the table list — /Ping needs no key on the sandbox', async () => {
    stubFetch([answer(fixture('currency')), answer(fixture('tables-active'))]);
    expect(await octoposProvider.testConnection(credentials)).toEqual({ ok: true, message: 'Connected — currency RSD, 6 active tables on the register' });
    expect(calls.map((c) => c.url)).toEqual(['https://sandbox.octopos.rs/api/Currency/System', 'https://sandbox.octopos.rs/api/Table/Active']);
    stubFetch([answer(fixture('error-401'))]);
    expect(await octoposProvider.testConnection(credentials)).toEqual({ ok: false, message: 'The register rejected the API key' });
    expect(await octoposProvider.testConnection({ baseUrl: null, apiKey: null })).toMatchObject({ ok: false });
  });

  it('maps products (code, price in cents, category name, tax, for sale), tables and tax labels', async () => {
    stubFetch([answer(fixture('products'))]);
    const products = await octoposProvider.fetchProducts(credentials);
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/Product?active=true&isForSale=true');
    // Products without a code are dropped (the sample has one).
    expect(products.map((p) => p.code)).toEqual(['680', '0079', '621', '686']);
    expect(products.find((p) => p.code === '686')).toEqual({ code: '686', name: 'ACQUA PANA 250 CL', group: 'VODE', priceCents: 25000, taxLabel: '11%', active: true });
    expect(products.find((p) => p.code === '680')).toMatchObject({ group: 'SOKOVI', priceCents: 35000 });

    stubFetch([answer(fixture('tables-active'))]);
    expect(await octoposProvider.fetchTables(credentials)).toEqual([
      { id: 1, name: '01' },
      { id: 2, name: '02' },
      { id: 3, name: '03' },
      { id: 4, name: '04' },
      { id: 5, name: '05' },
      { id: 6, name: '06' },
    ]);
    // The spec's PageListDto shape is accepted too.
    stubFetch([new Response(JSON.stringify({ Success: true, Errors: [], Data: [{ TotalCount: 1, Items: [{ Id: 9, Name: 'B1', IsActive: true }, { Id: 10, Name: 'gone', IsDeleted: true }] }] }), { status: 200 })]);
    expect(await octoposProvider.fetchTables(credentials)).toEqual([{ id: 9, name: 'B1' }]);

    stubFetch([answer(fixture('tax'))]);
    const taxes = await octoposProvider.fetchTaxLabels(credentials);
    expect(taxes).toHaveLength(13);
    expect(taxes.find((t) => t.label === 'Ђ')).toEqual({ label: 'Ђ', name: 'Ђ (20% na jed. cenu)', percent: 20 });
    expect(taxes.find((t) => t.label === 'F')).toMatchObject({ percent: 11 });
  });

  it('ESIR: creates a fiscalised receipt in one call (cash / instant) and parses the receipt incl. the PFR time', async () => {
    stubFetch([answer(fixture('weborder-cash'))]);
    const cash = await octoposProvider.createOrder(
      { externalId: 'otvori-dev-probe-1793025902-cash', lines: [line()], note: 'otvori sandbox probe', tableName: null, payment: { kind: 'cash', amountCents: 25000 }, lineWidth: 40 },
      credentials,
    );
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/WebOrder');
    expect(sent()).toEqual({
      ExternalId: 'otvori-dev-probe-1793025902-cash',
      Info: 'otvori sandbox probe',
      // A code the register knows goes without the create fields: Octopos would otherwise rename the product.
      Items: [{ ProductCode: '686', Quantity: 1, Price: 250 }],
      Payments: [{ FiscalPaymentTypeId: 1, Amount: 250 }],
      FiscalReceiptData: { ReturnTextualRepresentation: true, LineWidth: 40 },
    });
    expect(cash.posRef).toBe('57691');
    expect(cash.receipt).toMatchObject({
      invoiceNumber: 'SEU257EZ-Dt1Ov2o0-10369',
      verificationUrl: expect.stringMatching(/^https:\/\/sandbox\.suf\.purs\.gov\.rs\/v\/\?vl=/),
      textBottom: expect.stringContaining('КРАЈ ФИСКАЛНОГ РАЧУНА'),
      doubleFontLines: [],
      // SdcDateTime "2026-10-26T15:45:04.76" is Belgrade wall time (CET after the DST change on 25 Oct).
      issuedAt: '2026-10-26T14:45:04.760Z',
    });
    expect(cash.receipt?.textTop).toContain('Готовина:                         250,00');

    stubFetch([answer(fixture('weborder-instant'))]);
    const instant = await octoposProvider.createOrder(
      { externalId: 'x', lines: [line({ quantity: 2, note: 'bez leda' })], note: null, tableName: null, payment: { kind: 'instant', amountCents: 50000 }, lineWidth: 40 },
      credentials,
    );
    expect(sent()).toMatchObject({ Payments: [{ FiscalPaymentTypeId: 6, Amount: 500 }], Items: [expect.objectContaining({ Quantity: 2, Info: 'bez leda' })] });
    expect(sent()).not.toHaveProperty('TableName');
    expect(instant.receipt?.textTop).toContain('Инстант плаћање:                  500,00');
    expect(instant.receipt?.invoiceNumber).toBe('SEU257EZ-Dt1Ov2o0-10370');

    // The older documented shape { FiscalReceipt, Value } is accepted as well.
    stubFetch([new Response(JSON.stringify({ Success: true, Errors: [], Data: { FiscalReceipt: { Id: 1, InvoiceNumber: 'A-B-1', TextTop: 't', TextBottom: 'b', VerificationUrl: 'u' }, Value: 309484 } }))]);
    const legacy = await octoposProvider.createOrder({ externalId: 'y', lines: [line()], note: null, tableName: null, payment: { kind: 'cash', amountCents: 25000 }, lineWidth: 40 }, credentials);
    expect(legacy).toMatchObject({ posRef: '309484', receipt: { invoiceNumber: 'A-B-1', textTop: 't' } });
  });

  it('ESIR: an unknown code with a label the PFR does not know is refused (not retried); with a known label the register creates the product', async () => {
    stubFetch([answer(fixture('weborder-newcode-rejected'))]);
    const refused = (await octoposProvider
      .createOrder({ externalId: 'n', lines: [line({ productCode: 'OTV-TEST-1', productName: 'otvori test artikal', taxLabel: 'Ђ', unitPriceCents: 12000, createIfMissing: true })], note: null, tableName: null, payment: { kind: 'instant', amountCents: 12000 }, lineWidth: 40 }, credentials)
      .catch((e: unknown) => e)) as OctoposError;
    expect(refused).toMatchObject({ kind: 'rejected', retryable: false, reason: 'invalidTaxLabel' });
    expect(refused.message).toContain('Neispravne poreske stope');
    expect(sent()).toMatchObject({ Items: [{ ProductCode: 'OTV-TEST-1', ProductName: 'otvori test artikal', GroupName: 'otvori', UnitMeasure: 'KOM', TaxLabel: 'Ђ', Price: 120 }] });

    stubFetch([answer(fixture('weborder-newcode'))]);
    const created = await octoposProvider.createOrder(
      { externalId: 'n', lines: [line({ productCode: 'OTV-TEST-1', productName: 'otvori test artikal', taxLabel: 'F', unitPriceCents: 12000, createIfMissing: true })], note: null, tableName: null, payment: { kind: 'instant', amountCents: 12000 }, lineWidth: 40 },
      credentials,
    );
    expect(created.receipt?.textTop).toContain('otvori test artikal (F)');
  });

  it('POS: opens an order on a table (TableName, no Payments) and reads it back with codes, the BillCumulative id and the table state', async () => {
    stubFetch([answer(fixture('weborder-table-open'))]);
    const opened = await octoposProvider.createOrder({ externalId: 'otvori-dev-probe-1793025949-table', lines: [line({ note: 'bez leda' })], note: 'otvori sandbox probe (open on table)', tableName: '01', payment: null, lineWidth: 40 }, credentials);
    expect(opened).toEqual({ posRef: '66871', receipt: null });
    expect(sent()).toEqual({
      ExternalId: 'otvori-dev-probe-1793025949-table',
      TableName: '01',
      Info: 'otvori sandbox probe (open on table)',
      Items: [{ ProductCode: '686', Quantity: 1, Price: 250, Info: 'bez leda' }],
    });

    stubFetch([answer(fixture('weborder-get')), answer(fixture('tables-occupied'))]);
    const open = await octoposProvider.getOrder('66871', credentials);
    expect(calls[0]!.url).toBe('https://sandbox.octopos.rs/api/WebOrder/66871');
    expect(open).toEqual({
      billCumulativeId: '57694',
      tableName: '01',
      revoked: false,
      occupied: true,
      lines: [{ productCode: '686', productName: 'ACQUA PANA 250 CL', quantity: 1, unitPriceCents: 25000 }],
    });
    // Unknown id → null (the register answers 400 "Resource not found" / a crash for foreign ids).
    stubFetch([answer(fixture('weborder-cancel-unknown'))]);
    expect(await octoposProvider.getOrder('1', credentials)).toBeNull();
    expect(await octoposProvider.getOrder('not-a-number', credentials)).toBeNull();
  });

  it('POS close, reissue: cancels the table order by ExternalId and issues the receipt with FiscalPaymentTypeId 6', async () => {
    stubFetch([answer(fixture('weborder-get')), answer(fixture('tables-occupied')), answer(fixture('weborder-cancel')), answer(fixture('weborder-instant'))]);
    const closed = await octoposProvider.closeOrder(
      { externalId: 'otvori-dev-o1', receiptExternalId: 'otvori-dev-o1-r', posRef: '66871', lines: [line({ quantity: 2 })], note: null, payment: { kind: 'instant', amountCents: 50000 }, strategy: 'reissue', payPaymentTypeId: null, lineWidth: 40 },
      credentials,
    );
    expect(calls.map((c) => `${c.init.method} ${c.url.replace('https://sandbox.octopos.rs/api', '')}`)).toEqual([
      'GET /WebOrder/66871',
      'GET /Table/Occupied',
      'POST /WebOrder/otvori-dev-o1/Cancel',
      'POST /WebOrder',
    ]);
    expect(sent(3)).toMatchObject({ ExternalId: 'otvori-dev-o1-r', Payments: [{ FiscalPaymentTypeId: 6, Amount: 500 }], FiscalReceiptData: { ReturnTextualRepresentation: true, LineWidth: 40 } });
    expect(sent(3)).not.toHaveProperty('TableName');
    expect(closed.receipt.invoiceNumber).toBe('SEU257EZ-Dt1Ov2o0-10370');
    expect(closed.receipt.textTop).toContain('Инстант плаћање');

    // The open never reached us (duplicate ExternalId recovery): no read-back, cancel by ExternalId still runs; "not found" is fine.
    stubFetch([answer(fixture('weborder-cancel-unknown')), answer(fixture('weborder-instant'))]);
    const noRef = await octoposProvider.closeOrder(
      { externalId: 'otvori-dev-o2', receiptExternalId: 'otvori-dev-o2-r', posRef: null, lines: [line()], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'reissue', payPaymentTypeId: null, lineWidth: 40 },
      credentials,
    );
    expect(calls.map((c) => c.init.method)).toEqual(['POST', 'POST']);
    expect(noRef.receipt.invoiceNumber).toBe('SEU257EZ-Dt1Ov2o0-10370');
  });

  it('POS close: refuses to fiscalise twice when the till already closed the table (free again, order not storno)', async () => {
    const freeTables = new Response(JSON.stringify({ Success: true, Errors: [], Warnings: [], Data: [] }), { status: 200 });
    stubFetch([answer(fixture('weborder-get')), freeTables]);
    const error = (await octoposProvider
      .closeOrder({ externalId: 'e', receiptExternalId: 'e-r', posRef: '66871', lines: [line()], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'reissue', payPaymentTypeId: null, lineWidth: 40 }, credentials)
      .catch((e: unknown) => e)) as OctoposError;
    expect(error).toMatchObject({ kind: 'rejected', retryable: false, reason: 'alreadyClosed' });
    expect(calls).toHaveLength(2);
  });

  it('POS close, pay: posts the register’s internal PaymentTypeId to /WebOrder/{billCumulativeId}/Pay; "already printed" falls back to the stored receipt', async () => {
    stubFetch([answer(fixture('weborder-get')), answer(fixture('tables-occupied')), answer(fixture('weborder-pay'))]);
    const paid = await octoposProvider.closeOrder(
      { externalId: 'e', receiptExternalId: 'e-r', posRef: '66871', lines: [line()], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'pay', payPaymentTypeId: 2, lineWidth: 40 },
      credentials,
    );
    expect(calls[2]!.url).toBe('https://sandbox.octopos.rs/api/WebOrder/57694/Pay');
    expect(sent(2)).toEqual({ Payments: [{ PaymentTypeId: 2, FiscalPaymentTypeId: 6, Amount: 250 }], ReturnTextualRepresentation: true, LineWidth: 40 });
    expect(paid).toMatchObject({ posRef: '66871', receipt: { invoiceNumber: 'SEU257EZ-Dt1Ov2o0-10372' } });

    stubFetch([answer(fixture('weborder-get')), answer(fixture('tables-occupied')), answer(fixture('weborder-pay-again-error')), answer(fixture('weborder-fiscalreceipt'))]);
    const again = await octoposProvider.closeOrder(
      { externalId: 'e', receiptExternalId: 'e-r', posRef: '66871', lines: [line()], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'pay', payPaymentTypeId: 2, lineWidth: 40 },
      credentials,
    );
    expect(calls[3]!.url).toBe('https://sandbox.octopos.rs/api/WebOrder/66871/FiscalReceipt?lineWidth=40');
    expect(again.receipt.invoiceNumber).toBe('SEU257EZ-Dt1Ov2o0-10369');

    const missing = (await octoposProvider
      .closeOrder({ externalId: 'e', receiptExternalId: 'e-r', posRef: '66871', lines: [line()], note: null, payment: { kind: 'instant', amountCents: 25000 }, strategy: 'pay', payPaymentTypeId: null, lineWidth: 40 }, credentials)
      .catch((e: unknown) => e)) as PosProviderError;
    expect(missing).toMatchObject({ kind: 'rejected', retryable: false });
  });

  it('sends the create-on-the-fly fields only for codes otvori generated, and keeps notes', () => {
    expect(toItems([line({ note: 'bez leda', groupName: 'Voda', taxLabel: 'Ђ' })])).toEqual([{ ProductCode: '686', Quantity: 1, Price: 250, Info: 'bez leda' }]);
    expect(toItems([line({ productCode: 'OTV-0A1B2C3D4E', productName: 'Limunada', groupName: null, taxLabel: 'Ђ', unitPriceCents: 30000, quantity: 2, createIfMissing: true })])).toEqual([
      { ProductCode: 'OTV-0A1B2C3D4E', ProductName: 'Limunada', GroupName: 'otvori', UnitMeasure: 'KOM', TaxLabel: 'Ђ', Quantity: 2, Price: 300 },
    ]);
  });
});
