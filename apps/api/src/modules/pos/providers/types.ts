import type { PosCloseStrategy, PosProduct, PosProviderKey, PosTableDto, PosTaxLabelDto } from '@qr-menu/shared';

export interface PosCredentials {
  baseUrl: string | null;
  apiKey: string | null;
}

/** One line as the register needs it, including what it takes to create the product when the code is unknown there. */
export interface PosLine {
  productCode: string;
  productName: string;
  groupName: string | null;
  /** Fiscal tax label used when the register creates the product. */
  taxLabel: string;
  /**
   * Send ProductName/GroupName/UnitMeasure/TaxLabel so the register creates the product. Only for codes otvori
   * generated itself (ESIR, item without a POS code): for a code the register already has, Octopos **overwrites**
   * that product's name and category with what we send (verified on the sandbox, docs/octopos.md).
   */
  createIfMissing: boolean;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}

export interface PosPayment {
  /** Instant payment (IPS) or cash; maps to the fiscal payment type on the receipt. */
  kind: 'instant' | 'cash';
  /** What to fiscalise: the order total without the tip (tips are not revenue). */
  amountCents: number;
}

export interface FiscalReceipt {
  invoiceNumber: string;
  verificationUrl: string;
  textTop: string;
  textBottom: string;
  /** The PFR's time stamp of the receipt (`SdcDateTime`), ISO. */
  issuedAt: string | null;
  /** Line indexes (within textTop + textBottom) the register wants printed in double size. */
  doubleFontLines: number[];
}

export interface CreateOrderParams {
  /** `otvori-<orderId>` (or `otvori-dev-…` against the shared sandbox); the register refuses a repeat. */
  externalId: string;
  lines: PosLine[];
  note: string | null;
  /** POS mode: open the order on this register table and do not fiscalise. */
  tableName: string | null;
  /** ESIR mode (or POS mode without an opened order): fiscalise in the same call. */
  payment: PosPayment | null;
  lineWidth: number;
}

export interface CreateOrderResult {
  /** The register's reference: the bill id for an opened table order, the receipt id for a fiscalised one. */
  posRef: string;
  receipt: FiscalReceipt | null;
}

export interface CloseOrderParams {
  /** ExternalId the order was opened with (cancelled by it in `reissue`). */
  externalId: string;
  /** ExternalId for the receipt that replaces it (`reissue`). */
  receiptExternalId: string;
  /** The register's bill id from the open; null when the open never reached us (duplicate ExternalId recovery). */
  posRef: string | null;
  lines: PosLine[];
  note: string | null;
  payment: PosPayment;
  strategy: PosCloseStrategy;
  /** `pay` strategy: the register's internal payment type id mapped to the fiscal type. */
  payPaymentTypeId: number | null;
  lineWidth: number;
}

export interface CloseOrderResult {
  posRef: string;
  receipt: FiscalReceipt;
}

/** What the register currently has on an order it opened for us (to spot items added live by the waiter). */
export interface PosOrderLine {
  productCode: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PosOpenOrder {
  /** Octopos: the BillCumulative id `/Pay` wants. */
  billCumulativeId: string | null;
  /** The register table it sits on (Octopos `TableName`). */
  tableName: string | null;
  /** The register shows it as cancelled/storno (Octopos: fully revoked lines, total 0). */
  revoked: boolean;
  /** Null when the register cannot say; false = the table is free again, i.e. the till closed or removed it. */
  occupied: boolean | null;
  lines: PosOrderLine[];
}

export type PosErrorKind =
  /** Network error / DNS / connection refused — retry. */
  | 'unreachable'
  /** No answer within the timeout — retry (the call may have gone through: ExternalId guards duplicates). */
  | 'timeout'
  /** Wrong API key — not retryable until the configuration changes. */
  | 'auth'
  /** The register refused the request (validation) — not retryable with the same input. */
  | 'rejected'
  /** The referenced order/receipt does not exist on the register. */
  | 'not_found'
  /** The register crashed or answered 5xx — retry. */
  | 'server'
  /** The answer did not match the documented shape. */
  | 'shape';

const RETRYABLE: Record<PosErrorKind, boolean> = {
  unreachable: true,
  timeout: true,
  auth: false,
  rejected: false,
  not_found: false,
  server: true,
  shape: false,
};

/** Base error of every provider; the queue retries only `retryable` ones and fails the rest at once. */
export class PosProviderError extends Error {
  constructor(
    public readonly kind: PosErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'PosProviderError';
  }

  get retryable(): boolean {
    return RETRYABLE[this.kind];
  }
}

export interface PosProvider {
  readonly key: PosProviderKey;
  testConnection(credentials: PosCredentials): Promise<{ ok: boolean; message: string }>;
  fetchProducts(credentials: PosCredentials): Promise<PosProduct[]>;
  /** The register's active tables (POS mode table mapping). */
  fetchTables(credentials: PosCredentials): Promise<PosTableDto[]>;
  /** The fiscal labels the venue's PFR accepts. */
  fetchTaxLabels(credentials: PosCredentials): Promise<PosTaxLabelDto[]>;
  /** ESIR: closed + fiscalised in one call (`payment` set); POS: opened on `tableName` without payment. */
  createOrder(params: CreateOrderParams, credentials: PosCredentials): Promise<CreateOrderResult>;
  /** POS mode: closes an order opened on a table with a payment and returns the fiscal receipt. */
  closeOrder(params: CloseOrderParams, credentials: PosCredentials): Promise<CloseOrderResult>;
  /** The register's current state of an opened order; null when it no longer exists there. */
  getOrder(posRef: string, credentials: PosCredentials): Promise<PosOpenOrder | null>;
  /** The fiscal receipt of a bill (by the bill id). */
  getFiscalReceipt(posRef: string, credentials: PosCredentials): Promise<FiscalReceipt | null>;
  /** Cancels an opened (unpaid) order by its ExternalId; a no-op when it is already gone. */
  cancelOrder(externalId: string, credentials: PosCredentials): Promise<void>;
}
