import { z } from 'zod';
import type { PosProduct, PosTableDto, PosTaxLabelDto } from '@qr-menu/shared';
import { zonedTimeToUtc } from '../../../utils/time.js';
import { OctoposClient, OctoposError } from './octopos/client.js';
import type { FiscalReceiptPrint, WebOrderDto, WebOrderItemDto } from './octopos/generated.js';
import { PosProviderError, type CreateOrderParams, type FiscalReceipt, type PosCredentials, type PosLine, type PosOpenOrder, type PosProvider } from './types.js';

/*
 * Octopos provider (docs/octopos.md), built on the typed client in ./octopos/. Verified against the sandbox on
 * 2026-10-26 — every request/response pair is in test/fixtures/octopos:
 *
 *   ESIR mode   POST /WebOrder { Items, Payments: [{ FiscalPaymentTypeId }], FiscalReceiptData } → the fiscal receipt
 *               text, verification URL and invoice number in one answer (Data = FiscalReceiptPrint).
 *   POS mode    POST /WebOrder { TableName, Items } → the bill id; the table shows as occupied on the till.
 *               Closing after an online payment: `reissue` = POST /WebOrder/{externalId}/Cancel + a fresh fiscalised
 *               POST /WebOrder (correct "Инстант плаћање" line); `pay` = POST /WebOrder/{billCumulativeId}/Pay, which
 *               labels the receipt by the register's internal PaymentTypeId (2 cash, 3 card) — only with a payment
 *               type Octopos maps to instant payments on that register.
 *
 * Prices on the wire are dinars with decimals; ours are minor units.
 */

export const FISCAL_PAYMENT_TYPE = { cash: 1, instant: 6 } as const;

const nullableString = z.string().nullable().optional();

export const octoposProductSchema = z.object({
  Id: z.coerce.number(),
  Name: z.string(),
  IsActive: z.boolean().default(true),
  Price: z.coerce.number(),
  Code: nullableString,
  CategoryId: z.coerce.number().nullable().optional(),
  ProductCategory: z.union([z.string(), z.object({ Name: z.string().optional() }).passthrough()]).nullable().optional(),
  TaxPercent: z.coerce.number().nullable().optional(),
  IsForSale: z.boolean().optional(),
});

export const octoposFiscalReceiptSchema = z.object({
  Id: z.coerce.number().optional(),
  TextTop: z.string().default(''),
  TextBottom: z.string().default(''),
  VerificationUrl: z.string().default(''),
  InvoiceNumber: z.string().default(''),
  DoubleFontLineIndexes: z.array(z.coerce.number()).nullable().optional(),
  SdcDateTime: nullableString,
});

/** POST /WebOrder answers with the bill id, the receipt itself (sandbox) or { FiscalReceipt, Value } (older docs). */
const createResponseSchema = z.union([
  z.coerce.number(),
  z.object({ FiscalReceipt: octoposFiscalReceiptSchema.nullable().optional(), Value: z.coerce.number().optional() }).passthrough(),
]);

const billSchema = z.object({
  Id: z.coerce.number(),
  BillCumulativeId: z.coerce.number().nullable().optional(),
  TableName: nullableString,
  IsRevoked: z.boolean().optional(),
  Amount: z.coerce.number().optional(),
  TotalAmount: z.coerce.number().optional(),
  Payments: z.array(z.unknown()).nullable().optional(),
  BillItems: z
    .array(
      z.object({
        ProductCode: nullableString,
        ProductName: z.string().default(''),
        Quantity: z.coerce.number(),
        RevokedQuantity: z.coerce.number().optional(),
        Price: z.coerce.number(),
      }).passthrough(),
    )
    .nullable()
    .optional(),
});

const tableSchema = z.object({ Id: z.coerce.number(), Name: z.string(), IsActive: z.boolean().optional(), IsDeleted: z.boolean().optional() }).passthrough();
/** The spec declares PageListDto[]; the sandbox returns the tables themselves. */
const tablesSchema = z.array(z.union([tableSchema, z.object({ Items: z.array(tableSchema).nullable().optional() }).passthrough()]));
const occupiedSchema = z.array(z.object({ Id: z.coerce.number(), Name: z.string(), Amount: z.coerce.number().optional() }).passthrough());
const taxesSchema = z.array(z.object({ FiscalLabel: z.string(), Name: z.string().default(''), Value: z.coerce.number().default(0) }).passthrough());
const currencySchema = z.union([z.object({ Code: z.string().optional() }).passthrough(), z.array(z.object({ Code: z.string().optional() }).passthrough())]);

export function toCents(dinars: number): number {
  return Math.round(dinars * 100);
}

export function toDinars(cents: number): number {
  return Math.round(cents) / 100;
}

function client(credentials: PosCredentials): OctoposClient {
  if (!credentials.baseUrl || !credentials.apiKey) throw new PosProviderError('auth', 'The POS connection is not configured');
  return new OctoposClient({ baseUrl: credentials.baseUrl, apiKey: credentials.apiKey });
}

/**
 * Items as the register wants them. The create-on-the-fly fields go only with codes otvori generated: for a code the
 * register knows, Octopos would rename the product and move it into our group (sandbox, 2026-10-26).
 */
export function toItems(lines: PosLine[]): WebOrderItemDto[] {
  return lines.map((line) => ({
    ProductCode: line.productCode,
    ...(line.createIfMissing ? { ProductName: line.productName, GroupName: line.groupName ?? 'otvori', UnitMeasure: 'KOM', TaxLabel: line.taxLabel } : {}),
    Quantity: line.quantity,
    Price: toDinars(line.unitPriceCents),
    ...(line.note ? { Info: line.note } : {}),
  }));
}

export function toPosProduct(product: z.infer<typeof octoposProductSchema>): PosProduct | null {
  const code = (product.Code ?? '').trim();
  if (!code) return null;
  const category = product.ProductCategory;
  const group = (typeof category === 'string' ? category : (category?.Name ?? '')).trim();
  return {
    code,
    name: product.Name.trim(),
    group: group || (product.CategoryId !== null && product.CategoryId !== undefined ? `#${product.CategoryId}` : null),
    priceCents: toCents(product.Price),
    taxLabel: product.TaxPercent === null || product.TaxPercent === undefined ? null : `${product.TaxPercent}%`,
    active: product.IsActive && product.IsForSale !== false,
  };
}

/** The PFR runs in Serbia; `SdcDateTime` comes without a zone ("2026-10-26T15:45:04.76") and is Belgrade wall time. */
export function parseSdcDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const wall = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!wall) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const [, y, m, d, h, min, sec = '0', frac = '0'] = wall;
  const base = zonedTimeToUtc(Number(y), Number(m), Number(d), Number(h), Number(min), 'Europe/Belgrade');
  return new Date(base.getTime() + Number(sec) * 1000 + Number(frac.padEnd(3, '0'))).toISOString();
}

export function receiptOf(raw: Partial<FiscalReceiptPrint> | z.infer<typeof octoposFiscalReceiptSchema> | null | undefined): FiscalReceipt | null {
  if (!raw || !raw.InvoiceNumber) return null;
  return {
    invoiceNumber: raw.InvoiceNumber,
    verificationUrl: raw.VerificationUrl ?? '',
    textTop: raw.TextTop ?? '',
    textBottom: raw.TextBottom ?? '',
    issuedAt: parseSdcDateTime(raw.SdcDateTime),
    doubleFontLines: raw.DoubleFontLineIndexes ?? [],
  };
}

function paymentsOf(payment: NonNullable<CreateOrderParams['payment']>) {
  return [{ FiscalPaymentTypeId: FISCAL_PAYMENT_TYPE[payment.kind], Amount: toDinars(payment.amountCents) }];
}

export const octoposProvider: PosProvider = {
  key: 'octopos',

  async testConnection(credentials) {
    try {
      const api = client(credentials);
      // /Ping, /Tax and /Table answer without a key on the sandbox; /Currency/System is the cheapest call that checks it.
      const currency = await api.call('Currency_GetSystem', {}, currencySchema);
      const code = (Array.isArray(currency) ? currency[0]?.Code : currency.Code) ?? '?';
      const tables = await this.fetchTables(credentials);
      return { ok: true, message: `Connected — currency ${code}, ${tables.length} active table${tables.length === 1 ? '' : 's'} on the register` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  },

  async fetchProducts(credentials) {
    const result = await client(credentials).call('Product_List', { query: { active: true, isForSale: true } }, z.array(z.unknown()));
    const products: PosProduct[] = [];
    for (const raw of result) {
      const parsed = octoposProductSchema.safeParse(raw);
      if (!parsed.success) continue;
      const product = toPosProduct(parsed.data);
      if (product) products.push(product);
    }
    return products;
  },

  async fetchTables(credentials): Promise<PosTableDto[]> {
    const result = await client(credentials).call('Table_GetActive', {}, tablesSchema);
    const tables: PosTableDto[] = [];
    for (const entry of result) {
      const items = 'Items' in entry && Array.isArray(entry.Items) ? entry.Items : 'Name' in entry ? [entry as z.infer<typeof tableSchema>] : [];
      for (const table of items) {
        if (table.IsActive === false || table.IsDeleted) continue;
        tables.push({ id: table.Id, name: table.Name });
      }
    }
    return tables;
  },

  async fetchTaxLabels(credentials): Promise<PosTaxLabelDto[]> {
    const result = await client(credentials).call('Tax_Get', {}, taxesSchema);
    return result.map((tax) => ({ label: tax.FiscalLabel, name: tax.Name, percent: tax.Value }));
  },

  async createOrder(params, credentials) {
    const body: WebOrderDto = {
      ExternalId: params.externalId,
      Items: toItems(params.lines),
      ...(params.note ? { Info: params.note } : {}),
      ...(params.tableName ? { TableName: params.tableName } : {}),
      ...(params.payment
        ? { Payments: paymentsOf(params.payment), FiscalReceiptData: { ReturnTextualRepresentation: true, LineWidth: params.lineWidth } }
        : {}),
    };
    const result = await client(credentials).call('WebOrder_Post', { body }, createResponseSchema);
    if (typeof result === 'number') return { posRef: String(result), receipt: null };
    const nested = result.FiscalReceipt ? receiptOf(result.FiscalReceipt) : receiptOf(result as Partial<FiscalReceiptPrint>);
    const id = result.Value ?? result.FiscalReceipt?.Id ?? (result as { Id?: number }).Id;
    if (id === undefined) throw new PosProviderError('shape', 'The register did not return an order id');
    return { posRef: String(id), receipt: nested };
  },

  async closeOrder(params, credentials) {
    const api = client(credentials);
    if (params.strategy === 'pay' && !params.payPaymentTypeId) {
      throw new PosProviderError('rejected', 'closeStrategy "pay" needs the register\'s payment type id for instant payments');
    }
    const open = params.posRef ? await this.getOrder(params.posRef, credentials) : null;
    // GET /WebOrder/{id} never shows payments; a table that is free again while the order is not storno means the
    // till closed it (and issued the receipt there) — a second receipt would fiscalise the same sale twice.
    if (open && !open.revoked && open.occupied === false) {
      throw new OctoposError('rejected', 'The register already closed this order at the till; the receipt was issued there', [], null, 'alreadyClosed');
    }

    if (params.strategy === 'pay') {
      if (!params.payPaymentTypeId) throw new PosProviderError('rejected', 'closeStrategy "pay" needs the register\'s payment type id for instant payments');
      if (!open?.billCumulativeId) throw new PosProviderError('not_found', 'The opened order is no longer on the register');
      try {
        const result = await api.call(
          'WebOrder_PayTableBill',
          {
            pathParams: { id: Number(open.billCumulativeId) },
            body: {
              Payments: [{ PaymentTypeId: params.payPaymentTypeId, FiscalPaymentTypeId: FISCAL_PAYMENT_TYPE[params.payment.kind], Amount: toDinars(params.payment.amountCents) }],
              ReturnTextualRepresentation: true,
              LineWidth: params.lineWidth,
            },
          },
          z.union([z.coerce.number(), octoposFiscalReceiptSchema]),
        );
        const receipt = typeof result === 'number' ? await this.getFiscalReceipt(params.posRef!, credentials) : receiptOf(result);
        if (!receipt) throw new PosProviderError('shape', 'The register closed the order but returned no fiscal receipt');
        return { posRef: params.posRef!, receipt };
      } catch (error) {
        if (error instanceof OctoposError && error.reason === 'alreadyClosed') {
          const receipt = await this.getFiscalReceipt(params.posRef!, credentials);
          if (receipt) return { posRef: params.posRef!, receipt };
        }
        throw error;
      }
    }

    // reissue: take the open order off the table (also when its id never reached us — the cancel goes by
    // ExternalId and "not found" is fine), then fiscalise the same lines with the right payment type.
    if (!open?.revoked) await this.cancelOrder(params.externalId, credentials);
    const created = await this.createOrder(
      { externalId: params.receiptExternalId, lines: params.lines, note: params.note, tableName: null, payment: params.payment, lineWidth: params.lineWidth },
      credentials,
    );
    const receipt = created.receipt ?? (await this.getFiscalReceipt(created.posRef, credentials));
    if (!receipt) throw new PosProviderError('shape', 'The register created the receipt but returned no fiscal data');
    return { posRef: created.posRef, receipt };
  },

  async getOrder(posRef, credentials): Promise<PosOpenOrder | null> {
    const id = Number(posRef);
    if (!Number.isInteger(id)) return null;
    let bill;
    try {
      bill = await client(credentials).call('WebOrder_Get', { pathParams: { id } }, billSchema.nullable());
    } catch (error) {
      if (error instanceof PosProviderError && (error.kind === 'not_found' || error.kind === 'rejected')) return null;
      throw error;
    }
    if (!bill) return null;
    const tableName = bill.TableName?.trim() || null;
    let occupied: boolean | null = null;
    if (tableName) {
      try {
        const occupiedTables = await client(credentials).call('Table_GetOccupied', {}, occupiedSchema);
        occupied = occupiedTables.some((table) => table.Name === tableName);
      } catch {
        occupied = null;
      }
    }
    // A cancelled table order reads back with its lines revoked and TotalAmount 0 (sandbox, 2026-10-26).
    const revoked = Boolean(bill.IsRevoked) || ((bill.Amount ?? 0) > 0 && bill.TotalAmount === 0);
    return {
      billCumulativeId: bill.BillCumulativeId === null || bill.BillCumulativeId === undefined ? null : String(bill.BillCumulativeId),
      tableName,
      revoked,
      occupied,
      lines: (bill.BillItems ?? []).map((item) => ({
        productCode: item.ProductCode?.trim() || null,
        productName: item.ProductName,
        quantity: item.Quantity,
        unitPriceCents: toCents(item.Price),
      })),
    };
  },

  async getFiscalReceipt(posRef, credentials) {
    const id = Number(posRef);
    if (!Number.isInteger(id)) return null;
    try {
      const result = await client(credentials).call('WebOrder_GetFiscalReceipt', { pathParams: { id }, query: { lineWidth: 40 } }, octoposFiscalReceiptSchema.nullable());
      return receiptOf(result);
    } catch (error) {
      if (error instanceof PosProviderError && error.kind === 'not_found') return null;
      throw error;
    }
  },

  async cancelOrder(externalId, credentials) {
    try {
      await client(credentials).call('WebOrder_CancelWebOrder', { pathParams: { externalId } }, z.unknown());
    } catch (error) {
      // "Resource not found": nothing (left) to cancel — the till closed or removed it, or an earlier attempt did.
      if (error instanceof PosProviderError && error.kind === 'not_found') return;
      throw error;
    }
  },
};

export { authorizationHeader } from './octopos/client.js';
