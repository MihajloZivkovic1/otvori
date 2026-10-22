import { randomBytes } from 'node:crypto';
import type { PosProduct } from '@qr-menu/shared';
import { logger } from '../../../utils/logger.js';
import type { CloseOrderParams, FiscalReceipt, PosLine, PosProvider, SendOrderParams } from './types.js';

/** What the mock register "received" (tests and the demo read it back). */
export interface MockPosCall {
  type: 'send_order' | 'close_order';
  externalId: string;
  tableName?: string;
  lines: PosLine[];
  amountCents?: number;
  paymentKind?: 'instant' | 'cash';
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
let failNext = 0;
let receiptCounter = 0;

export const mockPos = {
  calls(): readonly MockPosCall[] {
    return calls;
  },
  reset(): void {
    calls.length = 0;
    failNext = 0;
    receiptCounter = 0;
  },
  /** Make the next N register calls fail (tests the retry queue). */
  failNextCalls(count: number): void {
    failNext = count;
  },
  setCatalogue(products: PosProduct[]): void {
    catalogue.splice(0, catalogue.length, ...products);
  },
};

function maybeFail(): void {
  if (failNext > 0) {
    failNext -= 1;
    throw new Error('Mock register unreachable');
  }
}

function fakeReceipt(params: CloseOrderParams): FiscalReceipt {
  receiptCounter += 1;
  const invoiceNumber = `MOCKPFR0-MOCKPFR0-${String(receiptCounter).padStart(3, '0')}`;
  const width = 40;
  const line = (left: string, right: string) => `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
  const items = params.lines.flatMap((l) => [
    `${l.productName} (Ђ)`,
    line('', `${(l.unitPriceCents / 100).toFixed(2).replace('.', ',')} ${l.quantity} ${((l.unitPriceCents * l.quantity) / 100).toFixed(2).replace('.', ',')}`),
  ]);
  const total = (params.payment.amountCents / 100).toFixed(2).replace('.', ',');
  const textTop = [
    '=============ФИСКАЛНИ РАЧУН=============',
    'MOCK0000000',
    'otvori demo kasa',
    '----------------------------------------',
    'Касир: otvori',
    `ЕСИР број: mock/${receiptCounter}`,
    '-------------ПРОМЕТ ПРОДАЈА-------------',
    'Назив Цена Кол. Укупно',
    '----------------------------------------',
    ...items,
    '----------------------------------------',
    line('Укупан износ:', total),
    line(params.payment.kind === 'cash' ? 'Готовина:' : 'Инстант плаћање:', total),
    '========================================',
    `ПФР време: ${new Date().toLocaleString('sr-RS')}`,
    `ПФР број рачуна: ${invoiceNumber}`,
    '========================================',
  ].join('\r\n');
  return {
    invoiceNumber,
    verificationUrl: `https://sandbox.suf.purs.gov.rs/v/?vl=MOCK${randomBytes(12).toString('base64url')}`,
    textTop: `${textTop}\r\n`,
    textBottom: '=========КРАЈ ФИСКАЛНОГ РАЧУНА==========\r\n',
  };
}

/** Development register (POS_MOCK=true): logs what would be sent and answers like Octopos would. */
export const mockPosProvider: PosProvider = {
  key: 'mock',

  async testConnection() {
    return { ok: true, message: `Mock register ready — ${catalogue.filter((p) => p.active).length} products` };
  },

  async fetchProducts() {
    return catalogue.map((product) => ({ ...product }));
  },

  async sendOrder(params: SendOrderParams) {
    maybeFail();
    const entry: MockPosCall = { type: 'send_order', externalId: params.externalId, tableName: params.tableName, lines: params.lines, at: new Date().toISOString() };
    calls.push(entry);
    logger.info({ pos: 'mock', ...entry }, `[pos] would open order ${params.externalId} on table ${params.tableName}`);
    return { posRef: `mock-order-${calls.length}` };
  },

  async closeOrder(params: CloseOrderParams) {
    maybeFail();
    const entry: MockPosCall = {
      type: 'close_order',
      externalId: params.closeMode === 'reuse-external-id' || !params.openRef ? params.externalId : `${params.externalId}-close`,
      lines: params.lines,
      amountCents: params.payment.amountCents,
      paymentKind: params.payment.kind,
      at: new Date().toISOString(),
    };
    calls.push(entry);
    logger.info({ pos: 'mock', ...entry }, `[pos] would close ${entry.externalId} with ${params.payment.kind} ${params.payment.amountCents / 100}`);
    return { posRef: params.openRef ?? `mock-order-${calls.length}`, receipt: fakeReceipt(params) };
  },

  async getFiscalReceipt() {
    return null;
  },
};
