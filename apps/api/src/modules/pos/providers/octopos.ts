import { z } from 'zod';
import { POS_LIMITS, type PosProduct } from '@qr-menu/shared';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import type { FiscalReceipt, PosCredentials, PosLine, PosOrderLine, PosProvider, PosRef } from './types.js';

/*
 * Octopos API (https://octopos.rs/en/octopos-api/, notes in docs/octopos.md).
 *
 *   Authorization: Basic <token>          every request (the sandbox page shows `Bearer <token>`; both are accepted)
 *   GET  /product                         all products: Id, Name, IsActive, Price (dinars, decimal), Code, CategoryId, …
 *   POST /weborder                        create an order/receipt: Items[], Payments[] (FiscalPaymentTypeId), TableName,
 *                                         ExternalId, FiscalReceiptData { ReturnTextualRepresentation, LineWidth }
 *   GET  /weborder/{id}                   the order
 *   GET  /weborder/{id}/fiscalreceipt     textual receipt + VerificationUrl + InvoiceNumber
 *   Envelope: { Success, Errors[], Data } — 200 only when Success=true, otherwise 400 with Errors.
 *
 * Prices on the wire are in dinars with decimals; ours are minor units. Every response is treated as untrusted
 * input (parsed with Zod, numbers coerced), the sandbox is shared with other developers.
 */

const FISCAL_PAYMENT_TYPE = { cash: 1, instant: 6 } as const;

const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    Success: z.boolean(),
    Errors: z.array(z.unknown()).default([]),
    Data: data,
  });

export const octoposProductSchema = z.object({
  Id: z.coerce.number(),
  Name: z.string(),
  IsActive: z.boolean().default(true),
  Price: z.coerce.number(),
  Code: z.string().nullable().default(''),
  CategoryId: z.coerce.number().nullable().default(null),
  /** Undocumented but present on the sandbox. */
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
});

/** GET /weborder/{id}: BillItems carry ProductId, not the code; codes are resolved through the product list. */
const orderSchema = z.object({
  Id: z.coerce.number(),
  TableName: z.string().nullable().optional(),
  BillItems: z
    .array(z.object({ ProductId: z.coerce.number().nullable().optional(), ProductName: z.string().default(''), Quantity: z.coerce.number(), Price: z.coerce.number() }).passthrough())
    .default([]),
});

/** POST /weborder answers with the order id as a number, or with { Value, FiscalReceipt } when a receipt was asked for. */
const createResponseSchema = envelope(
  z.union([
    z.coerce.number(),
    z.object({ Value: z.coerce.number().optional(), Id: z.coerce.number().optional(), FiscalReceipt: octoposFiscalReceiptSchema.nullable().optional() }).passthrough(),
  ]),
);

function toCents(dinars: number): number {
  return Math.round(dinars * 100);
}

function toDinars(cents: number): number {
  return Math.round(cents) / 100;
}

/** The header value: a bare token is sent as `Basic <token>`; a value that already names a scheme is sent as is. */
export function authorizationHeader(apiKey: string): string {
  return /^(basic|bearer)\s/i.test(apiKey) ? apiKey : `Basic ${apiKey}`;
}

function unavailable(message: string): AppError {
  return new AppError(502, 'POS_UNAVAILABLE', message);
}

async function call<T extends z.ZodTypeAny>(
  credentials: PosCredentials,
  method: 'GET' | 'POST',
  path: string,
  schema: T,
  body?: unknown,
): Promise<z.infer<T>> {
  if (!credentials.baseUrl || !credentials.apiKey) throw new AppError(503, 'POS_UNAVAILABLE', 'The POS connection is not configured');
  const url = `${credentials.baseUrl.replace(/\/+$/, '')}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: authorizationHeader(credentials.apiKey),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw unavailable(`Could not reach the register (${error instanceof Error ? error.message : 'network error'})`);
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw unavailable(`The register answered ${response.status} without JSON`);
  }
  if (response.status === 401 || response.status === 403) throw unavailable('The register rejected the API key');
  // The error envelope carries `Data: 0`, so read Success/Errors before the strict per-call schema.
  const loose = json as { Success?: boolean; Errors?: unknown[] } | null;
  if (!response.ok || loose?.Success === false) {
    const errors = (loose?.Errors ?? []).map(String).join('; ') || `HTTP ${response.status}`;
    throw unavailable(`The register refused the request: ${errors}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn({ path, status: response.status, body: text.slice(0, 300) }, 'Unexpected Octopos response shape');
    throw unavailable(`Unexpected answer from the register (${response.status})`);
  }
  return parsed.data;
}

function toItems(lines: PosLine[]) {
  return lines.map((line) => ({
    ProductCode: line.productCode,
    // Name/group/unit/tax label let the register create a product it does not know; harmless for known codes.
    ProductName: line.productName,
    GroupName: line.groupName ?? 'otvori',
    UnitMeasure: 'kom',
    TaxLabel: 'Ђ',
    Quantity: line.quantity,
    Price: toDinars(line.unitPriceCents),
    ...(line.note ? { Info: line.note } : {}),
  }));
}

export function toPosProduct(product: z.infer<typeof octoposProductSchema>): PosProduct | null {
  const code = (product.Code ?? '').trim();
  if (!code) return null;
  const category = product.ProductCategory;
  const group = typeof category === 'string' ? category : (category?.Name ?? null);
  return {
    code,
    name: product.Name.trim(),
    group: group || (product.CategoryId !== null ? `#${product.CategoryId}` : null),
    priceCents: toCents(product.Price),
    taxLabel: product.TaxPercent === null || product.TaxPercent === undefined ? null : `${product.TaxPercent}%`,
    active: product.IsActive && product.IsForSale !== false,
  };
}

function receiptOf(raw: z.infer<typeof octoposFiscalReceiptSchema> | null | undefined): FiscalReceipt | null {
  if (!raw || !raw.InvoiceNumber) return null;
  return { invoiceNumber: raw.InvoiceNumber, verificationUrl: raw.VerificationUrl, textTop: raw.TextTop, textBottom: raw.TextBottom };
}

export const octoposProvider: PosProvider = {
  key: 'octopos',

  async testConnection(credentials) {
    try {
      const products = await this.fetchProducts(credentials);
      return { ok: true, message: `Connected — ${products.length} products with a code on the register` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  },

  async fetchProducts(credentials) {
    const result = await call(credentials, 'GET', '/product', envelope(z.array(z.unknown())));
    const products: PosProduct[] = [];
    for (const raw of result.Data) {
      const parsed = octoposProductSchema.safeParse(raw);
      if (!parsed.success) continue;
      const product = toPosProduct(parsed.data);
      if (product) products.push(product);
    }
    return products;
  },

  async sendOrder(params, credentials): Promise<PosRef> {
    const result = await call(credentials, 'POST', '/weborder', createResponseSchema, {
      TableName: params.tableName,
      ExternalId: params.externalId,
      Items: toItems(params.lines),
      ...(params.order.note ? { Info: params.order.note } : {}),
    });
    const id = typeof result.Data === 'number' ? result.Data : (result.Data.Value ?? result.Data.Id);
    if (id === undefined) throw unavailable('The register did not return an order id');
    return { posRef: String(id) };
  },

  async closeOrder(params, credentials) {
    // Open question (docs/octopos.md): closing an order opened on a table — same ExternalId or a new receipt.
    const externalId = params.closeMode === 'reuse-external-id' || !params.openRef ? params.externalId : `${params.externalId}-close`;
    const result = await call(credentials, 'POST', '/weborder', createResponseSchema, {
      ExternalId: externalId,
      Items: toItems(params.lines),
      Payments: [{ FiscalPaymentTypeId: FISCAL_PAYMENT_TYPE[params.payment.kind], Amount: toDinars(params.payment.amountCents) }],
      FiscalReceiptData: { ReturnTextualRepresentation: true, LineWidth: POS_LIMITS.receiptLineWidth },
      ...(params.order.note ? { Info: params.order.note } : {}),
    });
    if (typeof result.Data === 'number') {
      // No receipt in the answer: fetch it separately.
      const receipt = await this.getFiscalReceipt(String(result.Data), credentials);
      return { posRef: String(result.Data), receipt };
    }
    const id = result.Data.Value ?? result.Data.Id ?? result.Data.FiscalReceipt?.Id;
    return { posRef: String(id ?? params.openRef ?? externalId), receipt: receiptOf(result.Data.FiscalReceipt) };
  },

  async getOrder(posRef, credentials): Promise<PosOrderLine[] | null> {
    let result;
    try {
      result = await call(credentials, 'GET', `/weborder/${encodeURIComponent(posRef)}`, envelope(orderSchema.nullable()));
    } catch (error) {
      if (error instanceof AppError && /refused the request/.test(error.message)) return null;
      throw error;
    }
    if (!result.Data) return null;
    const products = await call(credentials, 'GET', '/product', envelope(z.array(z.unknown())));
    const codeById = new Map<number, string>();
    for (const raw of products.Data) {
      const parsed = octoposProductSchema.safeParse(raw);
      if (parsed.success && parsed.data.Code) codeById.set(parsed.data.Id, parsed.data.Code.trim());
    }
    return result.Data.BillItems.map((item) => ({
      productCode: item.ProductId === null || item.ProductId === undefined ? null : (codeById.get(item.ProductId) ?? null),
      productName: item.ProductName,
      quantity: item.Quantity,
      unitPriceCents: toCents(item.Price),
    }));
  },

  async getFiscalReceipt(posRef, credentials) {
    const result = await call(
      credentials,
      'GET',
      `/weborder/${encodeURIComponent(posRef)}/fiscalreceipt?lineWidth=${POS_LIMITS.receiptLineWidth}`,
      envelope(octoposFiscalReceiptSchema.nullable()),
    );
    return receiptOf(result.Data);
  },
};
