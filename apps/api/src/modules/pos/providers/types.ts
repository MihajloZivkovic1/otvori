import type { PosCloseMode, PosProduct, PosProviderKey } from '@qr-menu/shared';
import type { Order } from '../../../db/models/order.model.js';

export interface PosCredentials {
  baseUrl: string | null;
  apiKey: string | null;
}

/** One line as the register needs it (code + what to create if the code is unknown there). */
export interface PosLine {
  productCode: string;
  productName: string;
  groupName: string | null;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
}

export interface PosOrderRequest {
  order: Order;
  lines: PosLine[];
  /** `otvori-<orderId>` (or `otvori-dev-…` against the shared sandbox). */
  externalId: string;
}

export interface SendOrderParams extends PosOrderRequest {
  tableName: string;
}

export interface ClosePayment {
  /** Instant payment (IPS) or cash; maps to the register's fiscal payment type. */
  kind: 'instant' | 'cash';
  /** What to fiscalise: the order total without the tip (tips are not revenue). */
  amountCents: number;
}

export interface CloseOrderParams extends PosOrderRequest {
  payment: ClosePayment;
  closeMode: PosCloseMode;
  /** Set when the order was opened on a table first (the register's reference for it). */
  openRef: string | null;
  printOnClose: boolean;
}

export interface FiscalReceipt {
  invoiceNumber: string;
  verificationUrl: string;
  textTop: string;
  textBottom: string;
}

export interface PosRef {
  /** The register's reference for the created order/receipt. */
  posRef: string;
}

export interface PosProvider {
  readonly key: PosProviderKey;
  testConnection(credentials: PosCredentials): Promise<{ ok: boolean; message: string }>;
  fetchProducts(credentials: PosCredentials): Promise<PosProduct[]>;
  /** Opens the order on a table (no payment yet). */
  sendOrder(params: SendOrderParams, credentials: PosCredentials): Promise<PosRef>;
  /** Closes the order with a payment and asks for the fiscal receipt text. */
  closeOrder(params: CloseOrderParams, credentials: PosCredentials): Promise<PosRef & { receipt: FiscalReceipt | null }>;
  getFiscalReceipt(posRef: string, credentials: PosCredentials): Promise<FiscalReceipt | null>;
}
