import { randomBytes } from 'node:crypto';
import type { PosProduct, PosTableDto, PosTaxLabelDto } from '@qr-menu/shared';
import { logger } from '../../../utils/logger.js';
import { PosProviderError, type CloseOrderParams, type CreateOrderParams, type FiscalReceipt, type PosLine, type PosOpenOrder, type PosOrderLine, type PosPayment, type PosProvider } from './types.js';

/** What the mock register "received" (tests and the demo read it back). */
export interface MockPosCall {
  type: 'create_order' | 'close_order' | 'cancel_order';
  externalId: string;
  tableName?: string | null;
  lines: PosLine[];
  amountCents?: number;
  paymentKind?: 'instant' | 'cash';
  strategy?: CloseOrderParams['strategy'];
  at: string;
}

const calls: MockPosCall[] = [];
/** Codes the mock register "knows" (what `fetchProducts` returns). Tests can extend it. */
const catalogue: PosProduct[] = [
  { code: 'ESP', name: 'Espresso', group: 'Kafa', priceCents: 18000, taxLabel: '20%', active: true },
  { code: 'CAP', name: 'Kapućino', group: 'Kafa', priceCents: 25000, taxLabel: '20%', active: true },
  { code: 'LAT', name: 'Latte', group: 'Kafa', priceCents: 27000, taxLabel: '20%', active: true },
  { code: 'TST', name: 'Tost sa avokadom', group: 'Doručak', priceCents: 52000, taxLabel: '10%', active: true },
  { code: 'OLD', name: 'Stari artikal', group: 'Arhiva', priceCents: 10000, taxLabel: '20%', active: false },
];
const TABLES: PosTableDto[] = [
  { id: 1, name: '01' },
  { id: 2, name: '02' },
  { id: 3, name: 'B1' },
  { id: 4, name: 'B2' },
];
const TAXES: PosTaxLabelDto[] = [
  { label: 'Ђ', name: 'Ђ (20% na jed. cenu)', percent: 20 },
  { label: 'Е', name: 'Е (10% na jed. cenu)', percent: 10 },
  { label: 'Г', name: 'Г (0% na jed. cenu)', percent: 0 },
];
let failNext = 0;
let rejectNext: string | null = null;
let receiptCounter = 0;
/** What the mock register holds per opened order (posRef → state); `addLiveLines` simulates the waiter typing more. */
const openOrders = new Map<string, { externalId: string; lines: PosOrderLine[]; closed: boolean }>();

export const mockPos = {
  calls(): readonly MockPosCall[] {
    return calls;
  },
  reset(): void {
    calls.length = 0;
    failNext = 0;
    rejectNext = null;
    receiptCounter = 0;
    openOrders.clear();
  },
  /** Simulates items the waiter added at the register after the app opened the order. */
  addLiveLines(posRef: string, lines: PosOrderLine[]): void {
    const open = openOrders.get(posRef);
    if (open) open.lines.push(...lines);
  },
  /** Simulates the waiter closing the table at the till (payments present). */
  closeAtTill(posRef: string): void {
    const open = openOrders.get(posRef);
    if (open) open.closed = true;
  },
  /** Make the next N register calls fail with a retryable (network) error — tests the retry queue. */
  failNextCalls(count: number): void {
    failNext = count;
  },
  /** Make the next call fail with a non-retryable refusal (validation), like an unknown tax label. */
  rejectNextCall(message: string): void {
    rejectNext = message;
  },
  setCatalogue(products: PosProduct[]): void {
    catalogue.splice(0, catalogue.length, ...products);
  },
};

function maybeFail(): void {
  if (failNext > 0) {
    failNext -= 1;
    throw new PosProviderError('unreachable', 'Mock register unreachable');
  }
  if (rejectNext) {
    const message = rejectNext;
    rejectNext = null;
    throw new PosProviderError('rejected', `The register refused the request: ${message}`);
  }
}

function fakeReceipt(lines: PosLine[], payment: PosPayment): FiscalReceipt {
  receiptCounter += 1;
  const invoiceNumber = `MOCKPFR0-MOCKPFR0-${String(receiptCounter).padStart(3, '0')}`;
  const width = 40;
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const line = (left: string, right: string) => `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
  const centred = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return `${' '.repeat(pad)}${text}`;
  };
  const items = lines.flatMap((l) => [`${l.productName} (${l.taxLabel})`, line('', `${money(l.unitPriceCents)} ${l.quantity} ${money(l.unitPriceCents * l.quantity)}`)]);
  const now = new Date();
  const textTop = [
    '=============ФИСКАЛНИ РАЧУН=============',
    centred('MOCK0000000'),
    centred('otvori demo kasa'),
    centred('Demo adresa 1'),
    centred('Београд'),
    '----------------------------------------',
    line('Касир:', 'otvori'),
    line('ЕСИР број:', `mock/${receiptCounter}`),
    '-------------ПРОМЕТ ПРОДАЈА-------------',
    centred('Артикли'),
    '========================================',
    'Назив    Цена        Кол.         Укупно',
    '----------------------------------------',
    ...items,
    '----------------------------------------',
    line('Укупан износ:', money(payment.amountCents)),
    line(payment.kind === 'cash' ? 'Готовина:' : 'Инстант плаћање:', money(payment.amountCents)),
    '========================================',
    line('ПФР време:', now.toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })),
    line('ПФР број рачуна:', invoiceNumber),
    line('Бројач рачуна:', `${receiptCounter}/${receiptCounter}ПП`),
    '========================================',
  ].join('\r\n');
  return {
    invoiceNumber,
    verificationUrl: `https://sandbox.suf.purs.gov.rs/v/?vl=MOCK${randomBytes(12).toString('base64url')}`,
    textTop: `${textTop}\r\n`,
    textBottom: '=========КРАЈ ФИСКАЛНОГ РАЧУНА==========\r\n',
    issuedAt: now.toISOString(),
    doubleFontLines: [],
  };
}

/** Development register (POS_MOCK=true): logs what would be sent and answers like Octopos would. */
export const mockPosProvider: PosProvider = {
  key: 'mock',

  async testConnection() {
    return { ok: true, message: `Mock register ready — ${catalogue.filter((p) => p.active).length} products, ${TABLES.length} tables` };
  },

  async fetchProducts() {
    return catalogue.map((product) => ({ ...product }));
  },

  async fetchTables() {
    return TABLES.map((table) => ({ ...table }));
  },

  async fetchTaxLabels() {
    return TAXES.map((tax) => ({ ...tax }));
  },

  async createOrder(params: CreateOrderParams) {
    maybeFail();
    if ([...openOrders.values()].some((o) => o.externalId === params.externalId)) {
      throw new PosProviderError('rejected', `The register refused the request: There is already bill with same external id: ${params.externalId}`);
    }
    const entry: MockPosCall = {
      type: 'create_order',
      externalId: params.externalId,
      tableName: params.tableName,
      lines: params.lines,
      ...(params.payment ? { amountCents: params.payment.amountCents, paymentKind: params.payment.kind } : {}),
      at: new Date().toISOString(),
    };
    calls.push(entry);
    const posRef = `mock-order-${calls.length}`;
    if (params.payment) {
      logger.info({ pos: 'mock', ...entry }, `[pos] would fiscalise ${params.externalId}: ${params.payment.kind} ${params.payment.amountCents / 100}`);
      openOrders.set(posRef, { externalId: params.externalId, lines: [], closed: true });
      return { posRef, receipt: fakeReceipt(params.lines, params.payment) };
    }
    logger.info({ pos: 'mock', ...entry }, `[pos] would open order ${params.externalId} on table ${params.tableName}`);
    openOrders.set(posRef, {
      externalId: params.externalId,
      lines: params.lines.map((l) => ({ productCode: l.productCode, productName: l.productName, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
      closed: false,
    });
    return { posRef, receipt: null };
  },

  async closeOrder(params: CloseOrderParams, credentials) {
    maybeFail();
    const open = params.posRef ? openOrders.get(params.posRef) : undefined;
    if (open?.closed) throw new PosProviderError('rejected', 'The register already closed this order at the till; the receipt was issued there');
    if (params.strategy === 'reissue') await this.cancelOrder(params.externalId, credentials);
    const entry: MockPosCall = {
      type: 'close_order',
      externalId: params.strategy === 'reissue' ? params.receiptExternalId : params.externalId,
      lines: params.lines,
      amountCents: params.payment.amountCents,
      paymentKind: params.payment.kind,
      strategy: params.strategy,
      at: new Date().toISOString(),
    };
    calls.push(entry);
    logger.info({ pos: 'mock', ...entry }, `[pos] would close ${params.externalId} (${params.strategy}) with ${params.payment.kind} ${params.payment.amountCents / 100}`);
    if (open) open.closed = true;
    const posRef = params.strategy === 'reissue' || !params.posRef ? `mock-order-${calls.length}` : params.posRef;
    if (params.strategy === 'reissue') openOrders.set(posRef, { externalId: params.receiptExternalId, lines: [], closed: true });
    return { posRef, receipt: fakeReceipt(params.lines, params.payment) };
  },

  async getOrder(posRef): Promise<PosOpenOrder | null> {
    const open = openOrders.get(posRef);
    return open ? { billCumulativeId: `bc-${posRef}`, tableName: null, revoked: false, occupied: !open.closed, lines: open.lines } : null;
  },

  async getFiscalReceipt() {
    return null;
  },

  async cancelOrder(externalId) {
    for (const [posRef, open] of openOrders) {
      if (open.externalId === externalId) openOrders.delete(posRef);
    }
    calls.push({ type: 'cancel_order', externalId, lines: [], at: new Date().toISOString() });
    logger.info({ pos: 'mock', externalId }, `[pos] would cancel ${externalId}`);
  },
};
