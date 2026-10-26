import { Op, Transaction } from 'sequelize';
import {
  POS_LIMITS,
  posExternalId,
  posReceiptExternalId,
  resolveText,
  type ApplyPosSyncInput,
  type OrderDto,
  type PosConfigDto,
  type PosProduct,
  type PosSyncPreviewDto,
  type PosSyncResultDto,
  type PosTableDto,
  type PosTaxLabelDto,
  type TranslatedText,
  type UpdatePosConfigInput,
} from '@qr-menu/shared';
import { moduleOn } from '../../config/features.js';
import { Category, MenuItem, Order, OrderItem, PosJob, Restaurant } from '../../db/models/index.js';
import type { PosJobPayload } from '../../db/models/pos-job.model.js';
import type { StoredPosConfig } from '../../db/models/restaurant.model.js';
import { sequelize } from '../../db/sequelize.js';
import { moduleDisabled } from '../../middleware/modules.js';
import { encryptSecret } from '../../utils/crypto.js';
import { AppError, badRequest, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { sendFiscalReceipt } from '../../utils/mailer.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import * as audit from '../audit/service.js';
import { publishOrder, toOrderDto } from '../ordering/service.js';
import { loadPublishedRestaurant } from '../public/service.js';
import { touchRestaurant } from '../shared/touch-restaurant.js';
import { isSandbox, posCredentialsOf, storedPosConfig, toPosConfigDto } from './config.js';
import { posProvider } from './providers/index.js';
import { OctoposError } from './providers/octopos/client.js';
import { PosProviderError, type FiscalReceipt, type PosLine } from './providers/types.js';
import { renderFiscalReceiptPdf } from './receipt-pdf.js';

const ITEMS_INCLUDE = { model: OrderItem, as: 'items' } as const;

/* ------------------------------------------------------------------ config */

async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId);
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

export async function getPosConfig(restaurantId: string): Promise<PosConfigDto> {
  return toPosConfigDto(await loadRestaurant(restaurantId));
}

export async function updatePosConfig(restaurantId: string, input: UpdatePosConfigInput): Promise<PosConfigDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const current = storedPosConfig(restaurant);
  const next: StoredPosConfig = {
    provider: input.provider ?? current.provider,
    mode: input.mode ?? current.mode,
    baseUrl: input.baseUrl === undefined ? current.baseUrl : input.baseUrl,
    apiKeyEncrypted: input.apiKey === undefined ? current.apiKeyEncrypted : encryptSecret(input.apiKey),
    taxLabel: input.taxLabel ?? current.taxLabel,
    taxNumber: input.taxNumber === undefined ? current.taxNumber : input.taxNumber || null,
    tableMapping: input.tableMapping ?? current.tableMapping,
    sendOrdersToPos: input.sendOrdersToPos ?? current.sendOrdersToPos,
    closeOnPayment: input.closeOnPayment ?? current.closeOnPayment,
    closeStrategy: input.closeStrategy ?? current.closeStrategy,
    payPaymentTypeId: input.payPaymentTypeId === undefined ? current.payPaymentTypeId : input.payPaymentTypeId,
  };
  // Empty mapping values mean "not mapped"; ESIR mode has no till, so nothing to open orders on.
  next.tableMapping = Object.fromEntries(Object.entries(next.tableMapping).filter(([, name]) => name.trim() !== ''));
  if (next.mode === 'esir') next.sendOrdersToPos = false;
  await sequelize.transaction(async (transaction) => {
    await restaurant.update({ posConfig: next }, { transaction });
    // sendOrdersToPos changes which items guests may order: refresh the public menu cache key.
    if (next.sendOrdersToPos !== current.sendOrdersToPos) await touchRestaurant(restaurantId, transaction);
  });
  const shape = (c: StoredPosConfig) => ({
    provider: c.provider,
    mode: c.mode,
    baseUrl: c.baseUrl,
    taxLabel: c.taxLabel,
    taxNumber: c.taxNumber,
    tableMapping: c.tableMapping,
    sendOrdersToPos: c.sendOrdersToPos,
    closeOnPayment: c.closeOnPayment,
    closeStrategy: c.closeStrategy,
    payPaymentTypeId: c.payPaymentTypeId,
    hasApiKey: c.apiKeyEncrypted !== null,
  });
  const changes = audit.diff(shape(current), shape(next));
  if (changes || input.apiKey !== undefined) {
    await audit.record({
      restaurantId,
      action: 'pos_config.update',
      entity: { type: 'restaurant', id: restaurantId, label: restaurant.name },
      before: changes?.before ?? {},
      after: { ...(changes?.after ?? {}), ...(input.apiKey !== undefined ? { apiKeyChanged: true } : {}) },
    });
  }
  return toPosConfigDto(restaurant);
}

export async function testPosConnection(restaurantId: string): Promise<{ ok: boolean; message: string }> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedPosConfig(restaurant);
  if (!config.provider) return { ok: false, message: 'Choose a provider first' };
  try {
    return await posProvider(config.provider).testConnection(posCredentialsOf(restaurant));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Connection failed' };
  }
}

/** The register's active tables, for the POS-mode table mapping. */
export async function listPosTables(restaurantId: string): Promise<PosTableDto[]> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedPosConfig(restaurant);
  return posProvider(config.provider).fetchTables(posCredentialsOf(restaurant));
}

/** The fiscal labels the venue's PFR accepts (the tax label picker). */
export async function listPosTaxLabels(restaurantId: string): Promise<PosTaxLabelDto[]> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedPosConfig(restaurant);
  return posProvider(config.provider).fetchTaxLabels(posCredentialsOf(restaurant));
}

/* ------------------------------------------------------------------ products ↔ menu */

const IMPORT_CATEGORY = { sr: 'Sa kase', en: 'From the register' } as const;

/** Fetches the register's products and diffs them against the menu (nothing is written). */
export async function previewPosSync(restaurantId: string): Promise<PosSyncPreviewDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedPosConfig(restaurant);
  const products = await posProvider(config.provider).fetchProducts(posCredentialsOf(restaurant));
  const items = await MenuItem.findAll({ where: { restaurantId }, attributes: ['id', 'name', 'priceCents', 'posProductCode'] });
  const byCode = new Map<string, MenuItem>();
  for (const item of items) if (item.posProductCode) byCode.set(item.posProductCode, item);
  const seen = new Set<string>();
  const create: PosProduct[] = [];
  const update: PosSyncPreviewDto['update'] = [];
  for (const product of products) {
    if (!product.active || seen.has(product.code)) continue;
    seen.add(product.code);
    const item = byCode.get(product.code);
    if (!item) {
      create.push(product);
    } else if (item.priceCents !== product.priceCents) {
      update.push({
        itemId: item.id,
        code: product.code,
        name: resolveText(item.name, restaurant.defaultLocale, restaurant.defaultLocale),
        currentPriceCents: item.priceCents,
        priceCents: product.priceCents,
      });
    }
  }
  const missing = items
    .filter((item) => item.posProductCode && !seen.has(item.posProductCode))
    .map((item) => ({ itemId: item.id, code: item.posProductCode!, name: resolveText(item.name, restaurant.defaultLocale, restaurant.defaultLocale) }));
  return {
    fetchedAt: new Date().toISOString(),
    create: create.sort((a, b) => a.name.localeCompare(b.name, 'sr')),
    update,
    missing,
    unmapped: items.filter((item) => !item.posProductCode).length,
  };
}

/** Applies the reviewed rows: new items (in `categoryId` or a "From the register" category) and price updates. */
export async function applyPosSync(restaurantId: string, input: ApplyPosSyncInput): Promise<PosSyncResultDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const config = storedPosConfig(restaurant);
  const wanted = new Set([...input.createCodes, ...input.updateCodes]);
  if (wanted.size === 0) return { created: 0, updated: 0, categoryId: null };
  const products = (await posProvider(config.provider).fetchProducts(posCredentialsOf(restaurant))).filter((p) => wanted.has(p.code));
  const byCode = new Map(products.map((p) => [p.code, p]));

  const result = await sequelize.transaction(async (transaction) => {
    let categoryId: string | null = null;
    let created = 0;
    let updated = 0;
    const priceChanges: { code: string; name: string | null; from: number; to: number }[] = [];

    for (const code of input.updateCodes) {
      const product = byCode.get(code);
      if (!product) continue;
      const current = await MenuItem.findAll({ where: { restaurantId, posProductCode: code }, attributes: ['name', 'priceCents'], transaction });
      const [count] = await MenuItem.update({ priceCents: product.priceCents }, { where: { restaurantId, posProductCode: code }, transaction });
      updated += count;
      for (const item of current) {
        if (item.priceCents !== product.priceCents) priceChanges.push({ code, name: audit.labelOf(item.name), from: item.priceCents, to: product.priceCents });
      }
    }

    const toCreate = input.createCodes.map((code) => byCode.get(code)).filter((p): p is PosProduct => Boolean(p));
    if (toCreate.length > 0) {
      if (input.categoryId) {
        const category = await Category.findOne({ where: { id: input.categoryId, restaurantId }, transaction });
        if (!category) throw badRequest('Unknown category');
        categoryId = category.id;
      } else {
        const categories = await Category.findAll({ where: { restaurantId }, attributes: ['id', 'name'], transaction });
        const existing = categories.find((category) => category.name.sr === IMPORT_CATEGORY.sr) ?? null;
        if (existing) {
          categoryId = existing.id;
        } else {
          const max = (await Category.max<number, Category>('sortOrder', { where: { restaurantId }, transaction })) ?? -1;
          const category = await Category.create({ restaurantId, name: { ...IMPORT_CATEGORY }, sortOrder: max + 1, isHidden: true }, { transaction });
          categoryId = category.id;
        }
      }
      const existingCodes = new Set(
        (await MenuItem.findAll({ where: { restaurantId, posProductCode: toCreate.map((p) => p.code) }, attributes: ['posProductCode'], transaction })).map(
          (i) => i.posProductCode,
        ),
      );
      const targetCategory: string = categoryId;
      let sortOrder = ((await MenuItem.max<number, MenuItem>('sortOrder', { where: { restaurantId, categoryId: targetCategory }, transaction })) ?? -1) + 1;
      for (const product of toCreate) {
        if (existingCodes.has(product.code)) continue;
        await MenuItem.create(
          {
            restaurantId,
            categoryId: targetCategory,
            name: { [restaurant.defaultLocale]: product.name } as TranslatedText,
            priceCents: product.priceCents,
            allergens: [],
            tags: [],
            isAvailable: true,
            unavailableUntil: null,
            sortOrder: sortOrder++,
            posProductCode: product.code,
          },
          { transaction },
        );
        created += 1;
      }
    }
    if (created > 0 || updated > 0) await touchRestaurant(restaurantId, transaction);
    return { created, updated, categoryId, priceChanges };
  });
  const { priceChanges, ...dto } = result;
  await audit.record({
    restaurantId,
    action: 'pos.sync',
    entity: { type: 'restaurant', id: restaurantId, label: restaurant.name },
    after: { created: dto.created, updated: dto.updated, createCodes: input.createCodes, ...(priceChanges.length ? { priceChanges } : {}) },
  });
  return dto;
}

/* ------------------------------------------------------------------ jobs: open on accept, fiscalise on payment */

function assertPosEnabled(restaurant: Restaurant): StoredPosConfig {
  if (!moduleOn(restaurant, 'pos')) throw moduleDisabled('pos');
  return storedPosConfig(restaurant);
}

/** ESIR mode: items the menu never mapped get a stable code so the register creates them on first sale. */
export function generatedProductCode(itemId: string): string {
  return `OTV-${itemId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function linesOf(order: Order, restaurant: Restaurant, items: Map<string, MenuItem>, config: StoredPosConfig): PosLine[] {
  const locale = restaurant.defaultLocale;
  return (order.items ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => {
      const item = line.menuItemId ? items.get(line.menuItemId) : undefined;
      const name = resolveText(line.name, locale, locale);
      let code = item?.posProductCode ?? null;
      const generated = !code;
      if (!code) {
        if (config.mode !== 'esir' || !line.menuItemId) {
          throw new PosProviderError('rejected', `Item "${name}" has no POS product code`);
        }
        code = generatedProductCode(line.menuItemId);
      }
      return {
        productCode: code,
        productName: name + (line.variantName ? ` ${line.variantName}` : ''),
        groupName: null,
        taxLabel: config.taxLabel,
        createIfMissing: generated,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
        note: line.lineNote,
      };
    });
}

async function enqueue(order: Order, type: PosJob['type'], payload: PosJobPayload | null): Promise<PosJob> {
  const [job] = await PosJob.findOrCreate({
    where: { orderId: order.id, type },
    defaults: { restaurantId: order.restaurantId, orderId: order.id, type, payload },
  });
  if (job.status === 'failed' || job.status === 'done') {
    await job.update({ status: 'queued', attempts: 0, nextRunAt: new Date(), lastError: null, payload: payload ?? job.payload });
  }
  return job;
}

async function queueFiscalisation(order: Order, paymentKind: 'instant' | 'cash'): Promise<void> {
  await enqueue(order, 'close_order', { amountCents: order.totalCents, paymentKind });
  await Order.update({ fiscalStatus: 'pending', fiscalError: null }, { where: { id: order.id, fiscalStatus: { [Op.notIn]: ['issued', 'manual'] } } });
  publishOrder('order.updated', (await Order.findByPk(order.id, { include: [ITEMS_INCLUDE] }))!);
}

async function posConfigFor(order: Order): Promise<StoredPosConfig | null> {
  const restaurant = await Restaurant.findByPk(order.restaurantId, { attributes: ['id', 'modules', 'posConfig'] });
  if (!restaurant || !moduleOn(restaurant, 'pos')) return null;
  const config = storedPosConfig(restaurant);
  return config.provider ? config : null;
}

/** Hook: staff accepted the order → POS mode with "send orders" opens it on the register's table. */
export async function onOrderAcceptedForPos(order: Order): Promise<void> {
  const config = await posConfigFor(order);
  if (!config || config.mode !== 'pos' || !config.sendOrdersToPos) return;
  await enqueue(order, 'send_order', null);
}

/** Hook: the guest paid online → fiscalise the pre-tip amount as an instant payment. */
export async function onOrderPaidForPos(order: Order): Promise<void> {
  const config = await posConfigFor(order);
  if (!config || !config.closeOnPayment) return;
  await queueFiscalisation(order, 'instant');
}

/** Hook: staff took cash → in ESIR mode there is no till, so Octopos issues the cash receipt for the venue. */
export async function onOrderCashForPos(order: Order): Promise<void> {
  const config = await posConfigFor(order);
  if (!config || config.mode !== 'esir' || !config.closeOnPayment) return;
  await queueFiscalisation(order, 'cash');
}

/** Staff "Retry": re-queues the failed fiscalisation (or the failed open) right away. */
export async function retryPosJobs(restaurantId: string, orderId: string): Promise<OrderDto> {
  const restaurant = await loadRestaurant(restaurantId);
  assertPosEnabled(restaurant);
  const order = await Order.findOne({ where: { id: orderId, restaurantId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  const jobs = await PosJob.findAll({ where: { orderId: order.id, status: 'failed' } });
  if (jobs.length === 0 && order.fiscalStatus === 'failed') {
    await enqueue(order, 'close_order', { amountCents: order.totalCents, paymentKind: order.paymentStatus === 'cash' ? 'cash' : 'instant' });
  }
  for (const job of jobs) await job.update({ status: 'queued', attempts: 0, nextRunAt: new Date(), lastError: null });
  if (order.fiscalStatus === 'failed') await order.update({ fiscalStatus: 'pending', fiscalError: null });
  const fresh = (await Order.findByPk(order.id, { include: [ITEMS_INCLUDE] }))!;
  publishOrder('order.updated', fresh);
  await audit.record({ restaurantId, action: 'order.fiscal_retry', entity: { type: 'order', id: order.id, label: `#${order.number}` } });
  return toOrderDto(fresh);
}

async function storeReceipt(order: Order, posRef: string, receipt: FiscalReceipt): Promise<void> {
  await order.update({
    posRef,
    fiscalStatus: 'issued',
    fiscalInvoiceNumber: receipt.invoiceNumber,
    fiscalVerificationUrl: receipt.verificationUrl,
    fiscalReceiptText: `${receipt.textTop}${receipt.textBottom}`,
    fiscalIssuedAt: receipt.issuedAt ? new Date(receipt.issuedAt) : new Date(),
    fiscalError: null,
  });
}

async function runJob(job: PosJob): Promise<void> {
  const order = await Order.findByPk(job.orderId, { include: [ITEMS_INCLUDE] });
  const restaurant = order ? await Restaurant.findByPk(order.restaurantId) : null;
  if (!order || !restaurant) {
    await job.update({ status: 'failed', lastError: 'Order or restaurant no longer exists' });
    return;
  }
  const config = storedPosConfig(restaurant);
  const provider = posProvider(config.provider);
  const credentials = posCredentialsOf(restaurant);
  const itemIds = (order.items ?? []).map((line) => line.menuItemId).filter((id): id is string => Boolean(id));
  const items = new Map((await MenuItem.findAll({ where: { id: itemIds, restaurantId: restaurant.id } })).map((item) => [item.id, item]));
  const lines = linesOf(order, restaurant, items, config);
  const dev = isSandbox(config);
  const externalId = posExternalId(order.id, dev);

  if (job.type === 'send_order') {
    const tableName = (order.tableId && config.tableMapping[order.tableId]) || String(order.tableNumber);
    try {
      const { posRef } = await provider.createOrder({ externalId, lines, note: order.note, tableName, payment: null, lineWidth: POS_LIMITS.receiptLineWidth }, credentials);
      await order.update({ posRef });
    } catch (error) {
      // The register already has it (an earlier attempt timed out after going through): nothing to redo. The
      // reference stays unknown; closing later cancels by ExternalId, which does not need it.
      if (error instanceof OctoposError && error.reason === 'duplicateExternalId') {
        logger.warn({ orderId: order.id, externalId }, 'Order already open on the register; keeping it');
      } else {
        throw error;
      }
    }
  } else {
    const payload = job.payload ?? {};
    const payment = { kind: payload.paymentKind ?? 'instant', amountCents: payload.amountCents ?? order.totalCents } as const;
    const opened = config.mode === 'pos' && (order.posRef !== null || config.sendOrdersToPos);
    let posRef: string;
    let receipt: FiscalReceipt | null;
    if (opened) {
      ({ posRef, receipt } = await provider.closeOrder(
        {
          externalId,
          receiptExternalId: posReceiptExternalId(order.id, dev),
          posRef: order.posRef,
          lines,
          note: order.note,
          payment,
          strategy: config.closeStrategy,
          payPaymentTypeId: config.payPaymentTypeId,
          lineWidth: POS_LIMITS.receiptLineWidth,
        },
        credentials,
      ));
    } else {
      // ESIR mode (or POS mode without an opened order): one call creates and fiscalises the receipt.
      const created = await provider.createOrder({ externalId, lines, note: order.note, tableName: null, payment, lineWidth: POS_LIMITS.receiptLineWidth }, credentials);
      posRef = created.posRef;
      receipt = created.receipt ?? (await provider.getFiscalReceipt(created.posRef, credentials));
    }
    if (!receipt) throw new PosProviderError('shape', 'The register did not return a fiscal receipt');
    await storeReceipt(order, posRef, receipt);
  }
  publishOrder('order.updated', (await Order.findByPk(order.id, { include: [ITEMS_INCLUDE] }))!);
}

/**
 * Runs due jobs once (the queue job calls this every 10 s). Each job is claimed with SKIP LOCKED so several runs
 * never process the same job. Network/server failures back off and finally give up; a refusal by the register
 * (validation, wrong key, unknown order) fails at once — the same request would fail again — and the order's
 * fiscal state becomes `failed` with the message for the waiter card.
 */
export async function runDuePosJobs(now = new Date(), limit = 20): Promise<{ ran: number; failed: number }> {
  const claimed = await sequelize.transaction(async (transaction) => {
    const jobs = await PosJob.findAll({
      where: { status: 'queued', nextRunAt: { [Op.lte]: now } },
      order: [['nextRunAt', 'ASC']],
      limit,
      transaction,
      lock: Transaction.LOCK.UPDATE,
      skipLocked: true,
    });
    for (const job of jobs) await job.update({ status: 'running', attempts: job.attempts + 1 }, { transaction });
    return jobs;
  });

  let failed = 0;
  for (const job of claimed) {
    try {
      await runJob(job);
      await job.update({ status: 'done', lastError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = !(error instanceof PosProviderError) || error.retryable;
      const delay = retryable ? POS_LIMITS.retryDelaysSeconds[job.attempts - 1] : undefined;
      if (delay === undefined) {
        failed += 1;
        await job.update({ status: 'failed', lastError: message });
        if (job.type === 'close_order') {
          await Order.update({ fiscalStatus: 'failed', fiscalError: message }, { where: { id: job.orderId, fiscalStatus: { [Op.notIn]: ['issued', 'manual'] } } });
          const order = await Order.findByPk(job.orderId, { include: [ITEMS_INCLUDE] });
          if (order) publishOrder('order.updated', order);
        }
        logger.error({ err: error, jobId: job.id, type: job.type, orderId: job.orderId, retryable }, 'POS job gave up');
      } else {
        await job.update({ status: 'queued', nextRunAt: new Date(now.getTime() + delay * 1000), lastError: message });
        logger.warn({ jobId: job.id, type: job.type, attempt: job.attempts, retryInSeconds: delay, message }, 'POS job failed; will retry');
      }
    }
  }
  return { ran: claimed.length, failed };
}

/* ------------------------------------------------------------------ mixed orders: the register must agree before online payment */

export interface RegisterMismatch {
  extra: { productCode: string | null; productName: string; quantity: number; unitPriceCents: number }[];
  missing: { productCode: string; productName: string; quantity: number }[];
}

/**
 * POS mode: compares what the register holds on the opened order with the app's lines (by product code and
 * quantity). A round the waiter typed at the register would otherwise be left out of the online payment and the
 * receipt; while the two differ the guest pays the whole table at the waiter. An unreachable register does not block.
 */
export async function registerMismatch(restaurant: Restaurant, order: Order): Promise<RegisterMismatch | null> {
  if (!moduleOn(restaurant, 'pos')) return null;
  const config = storedPosConfig(restaurant);
  if (!config.provider || config.mode !== 'pos' || !config.sendOrdersToPos || !order.posRef) return null;
  let registerOrder;
  try {
    registerOrder = await posProvider(config.provider).getOrder(order.posRef, posCredentialsOf(restaurant));
  } catch (error) {
    logger.warn({ err: error, orderId: order.id }, 'Could not read the order back from the register; allowing payment');
    return null;
  }
  if (!registerOrder) return null;
  const registerLines = registerOrder.lines;
  const items = new Map(
    (await MenuItem.findAll({ where: { id: (order.items ?? []).map((l) => l.menuItemId).filter((id): id is string => Boolean(id)), restaurantId: restaurant.id } })).map((i) => [i.id, i]),
  );
  const ours = new Map<string, number>();
  for (const line of order.items ?? []) {
    const code = line.menuItemId ? items.get(line.menuItemId)?.posProductCode : null;
    if (code) ours.set(code, (ours.get(code) ?? 0) + line.quantity);
  }
  const theirs = new Map<string, number>();
  const extra: RegisterMismatch['extra'] = [];
  for (const line of registerLines) {
    if (!line.productCode) {
      extra.push(line);
      continue;
    }
    theirs.set(line.productCode, (theirs.get(line.productCode) ?? 0) + line.quantity);
  }
  for (const line of registerLines) {
    if (!line.productCode) continue;
    const over = (theirs.get(line.productCode) ?? 0) - (ours.get(line.productCode) ?? 0);
    if (over > 0) {
      extra.push({ ...line, quantity: over });
      theirs.set(line.productCode, ours.get(line.productCode) ?? 0);
    }
  }
  const missing: RegisterMismatch['missing'] = [];
  for (const [code, quantity] of ours) {
    const short = quantity - (theirs.get(code) ?? 0);
    if (short > 0) {
      const name = (order.items ?? []).find((l) => l.menuItemId && items.get(l.menuItemId)?.posProductCode === code);
      missing.push({ productCode: code, productName: name ? resolveText(name.name, restaurant.defaultLocale, restaurant.defaultLocale) : code, quantity: short });
    }
  }
  return extra.length === 0 && missing.length === 0 ? null : { extra, missing };
}

/** Staff issued the receipt at the register by hand: no retry, no duplicate, nothing more for the guest. */
export async function markFiscalManual(restaurantId: string, orderId: string): Promise<OrderDto> {
  const restaurant = await loadRestaurant(restaurantId);
  assertPosEnabled(restaurant);
  const order = await Order.findOne({ where: { id: orderId, restaurantId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  if (order.fiscalStatus === 'issued') throw new AppError(409, 'INVALID_TRANSITION', 'The register already issued this receipt through the app');
  await PosJob.update({ status: 'done', lastError: null }, { where: { orderId: order.id, type: 'close_order', status: ['queued', 'failed'] } });
  await order.update({ fiscalStatus: 'manual', fiscalError: null });
  const fresh = (await Order.findByPk(order.id, { include: [ITEMS_INCLUDE] }))!;
  publishOrder('order.updated', fresh);
  await audit.record({ restaurantId, action: 'order.fiscal_manual', entity: { type: 'order', id: order.id, label: `#${order.number}` } });
  return toOrderDto(fresh);
}

/* ------------------------------------------------------------------ guest: the receipt as PDF and by e-mail */

async function loadIssuedOrder(slug: string, sessionId: string, orderId: string): Promise<{ restaurant: Restaurant; order: Order }> {
  const restaurant = await loadPublishedRestaurant(slug);
  const order = await Order.findOne({ where: { id: orderId, restaurantId: restaurant.id, sessionId } });
  if (!order) throw notFound('Order not found');
  if (order.fiscalStatus !== 'issued' || !order.fiscalInvoiceNumber || !order.fiscalVerificationUrl) {
    throw new AppError(409, 'PAYMENT_NOT_ALLOWED', 'No fiscal receipt has been issued for this order yet');
  }
  return { restaurant, order };
}

function receiptFilename(order: Order): string {
  return `fiskalni-racun-${(order.fiscalInvoiceNumber ?? order.id).replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`;
}

async function buildReceiptPdf(restaurant: Restaurant, order: Order): Promise<Buffer> {
  const config = storedPosConfig(restaurant);
  return renderFiscalReceiptPdf({
    venue: { name: restaurant.name, taxNumber: config.taxNumber, address: restaurant.address, city: restaurant.city },
    order: { number: order.number, tableNumber: order.tableNumber },
    receipt: {
      invoiceNumber: order.fiscalInvoiceNumber!,
      verificationUrl: order.fiscalVerificationUrl!,
      text: order.fiscalReceiptText ?? '',
      issuedAt: order.fiscalIssuedAt ?? order.paidAt ?? null,
    },
    footer: buildMenuUrl(restaurant.slug).replace(/^https?:\/\//, ''),
  });
}

/** GET /api/public/:slug/orders/:id/receipt.pdf (session-bound). */
export async function receiptPdf(slug: string, sessionId: string, orderId: string): Promise<{ pdf: Buffer; filename: string }> {
  const { restaurant, order } = await loadIssuedOrder(slug, sessionId, orderId);
  return { pdf: await buildReceiptPdf(restaurant, order), filename: receiptFilename(order) };
}

/** POST /api/public/:slug/orders/:id/receipt-email — the PDF attached, text + verification link in the body. */
export async function emailReceipt(slug: string, sessionId: string, orderId: string, email: string): Promise<void> {
  const { restaurant, order } = await loadIssuedOrder(slug, sessionId, orderId);
  let pdf: Buffer | null = null;
  try {
    pdf = await buildReceiptPdf(restaurant, order);
  } catch (error) {
    logger.error({ err: error, orderId: order.id }, 'Could not render the receipt PDF; mailing the text only');
  }
  await sendFiscalReceipt(email, {
    venue: restaurant.name,
    orderNumber: order.number,
    invoiceNumber: order.fiscalInvoiceNumber!,
    verificationUrl: order.fiscalVerificationUrl!,
    text: order.fiscalReceiptText ?? '',
    pdf,
  });
}

export { onOrderAcceptedForPos as acceptedHook, onOrderPaidForPos as paidHook };
