import { Op, Transaction, type Order as SequelizeOrder, type WhereOptions } from 'sequelize';
import {
  OPEN_ORDER_STATUSES,
  ORDERING_LIMITS,
  canTransitionOrder,
  isEffectivelyAvailable,
  orderExpiresAt,
  pickLocale,
  resolveText,
  type CreateOrderInput,
  type CreateServiceRequestInput,
  type ListOrdersQuery,
  type ListServiceRequestsQuery,
  type OrderDto,
  type OrderItemDto,
  type OrderStatus,
  type PublicOrderDto,
  type PublicServiceRequestDto,
  type ServiceRequestDto,
  type TranslatedText,
  type UpdateOrderStatusInput,
} from '@qr-menu/shared';
import {
  Category,
  ItemVariant,
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  RestaurantTable,
  ServiceRequest,
} from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { AppError, badRequest, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { toIso } from '../../utils/objects.js';
import { startOfDayInZone } from '../../utils/time.js';
import { loadPublishedRestaurant } from '../public/service.js';
import { orderingBus } from './events.js';

const ITEMS_INCLUDE = { model: OrderItem, as: 'items' } as const;
const ORDER_SORT: SequelizeOrder = [
  ['createdAt', 'ASC'],
  [ITEMS_INCLUDE, 'sortOrder', 'ASC'],
];

/* ------------------------------------------------------------------ errors */

const orderingDisabled = () =>
  new AppError(403, 'ORDERING_DISABLED', 'Ordering is not enabled for this restaurant');
const orderingPaused = (restaurant: Restaurant) =>
  new AppError(409, 'ORDERING_PAUSED', restaurant.pausedMessage ?? 'Ordering is paused right now', {
    pausedMessage: restaurant.pausedMessage,
  });
const tableNotFound = (number: number) => new AppError(404, 'TABLE_NOT_FOUND', `Table ${number} does not exist`);
const tableBlocked = (until: Date) =>
  new AppError(423, 'TABLE_BLOCKED', 'Ordering from this table is temporarily disabled. Please call the waiter.', {
    blockedUntil: until.toISOString(),
  });
const tooManyOpenOrders = () =>
  new AppError(
    409,
    'TOO_MANY_OPEN_ORDERS',
    `You already have ${ORDERING_LIMITS.maxOpenOrdersPerSession} open orders; wait until one is delivered`,
  );
const invalidTransition = (from: OrderStatus, to: OrderStatus) =>
  new AppError(409, 'INVALID_TRANSITION', `An order cannot go from "${from}" to "${to}"`, { from, to });

/* ------------------------------------------------------------------ DTOs */

function toOrderItemDto(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    variantId: item.variantId,
    name: item.name,
    variantName: item.variantName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    lineTotalCents: item.unitPriceCents * item.quantity,
    lineNote: item.lineNote,
  };
}

function sortedItems(order: Order): OrderItem[] {
  return [...(order.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function toOrderDto(order: Order): OrderDto {
  return {
    id: order.id,
    restaurantId: order.restaurantId,
    number: order.number,
    status: order.status,
    tableId: order.tableId,
    tableNumber: order.tableNumber,
    guestName: order.guestName,
    note: order.note,
    totalCents: order.totalCents,
    locale: order.locale,
    rejectedReason: order.rejectedReason,
    items: sortedItems(order).map(toOrderItemDto),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    acceptedAt: toIso(order.acceptedAt),
    deliveredAt: toIso(order.deliveredAt),
    closedAt: toIso(order.closedAt),
    expiresAt: order.status === 'new' ? orderExpiresAt(order.createdAt).toISOString() : null,
  };
}

export function toPublicOrderDto(order: Order, restaurant: Pick<Restaurant, 'currency' | 'defaultLocale'>): PublicOrderDto {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    tableNumber: order.tableNumber,
    guestName: order.guestName,
    note: order.note,
    totalCents: order.totalCents,
    currency: restaurant.currency,
    locale: order.locale,
    rejectedReason: order.rejectedReason,
    items: sortedItems(order).map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      variantId: item.variantId,
      name: resolveText(item.name, order.locale, restaurant.defaultLocale),
      variantName: item.variantName,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.unitPriceCents * item.quantity,
      lineNote: item.lineNote,
    })),
    createdAt: order.createdAt.toISOString(),
    acceptedAt: toIso(order.acceptedAt),
    deliveredAt: toIso(order.deliveredAt),
    closedAt: toIso(order.closedAt),
    expiresAt: order.status === 'new' ? orderExpiresAt(order.createdAt).toISOString() : null,
  };
}

export function toServiceRequestDto(request: ServiceRequest): ServiceRequestDto {
  return {
    id: request.id,
    restaurantId: request.restaurantId,
    tableId: request.tableId,
    tableNumber: request.tableNumber,
    type: request.type,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    doneAt: toIso(request.doneAt),
  };
}

function toPublicServiceRequestDto(request: ServiceRequest): PublicServiceRequestDto {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ loaders */

async function loadOrder(restaurantId: string, orderId: string): Promise<Order> {
  const order = await Order.findOne({ where: { id: orderId, restaurantId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  return order;
}

async function loadOrderForSession(restaurantId: string, sessionId: string, orderId: string): Promise<Order> {
  const order = await Order.findOne({ where: { id: orderId, restaurantId, sessionId }, include: [ITEMS_INCLUDE] });
  if (!order) throw notFound('Order not found');
  return order;
}

async function loadRestaurantBySlug(slug: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findOne({ where: { slug } });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

/** The table a guest claims to sit at: must exist for this restaurant and not be blocked. */
async function loadOrderingTable(restaurantId: string, number: number, now: Date): Promise<RestaurantTable> {
  const table = await RestaurantTable.findOne({ where: { restaurantId, number } });
  if (!table) throw tableNotFound(number);
  if (table.blockedUntil && table.blockedUntil.getTime() > now.getTime()) throw tableBlocked(table.blockedUntil);
  return table;
}

export function isTableBlocked(table: Pick<RestaurantTable, 'blockedUntil'>, now = new Date()): boolean {
  return Boolean(table.blockedUntil && table.blockedUntil.getTime() > now.getTime());
}

function publishOrder(type: 'order.created' | 'order.updated', order: Order): void {
  orderingBus.publish(order.restaurantId, { type, order: toOrderDto(order) });
}

function publishRequest(type: 'request.created' | 'request.updated', request: ServiceRequest): void {
  orderingBus.publish(request.restaurantId, { type, request: toServiceRequestDto(request) });
}

/* ------------------------------------------------------------------ guest: orders */

interface LineSnapshot {
  menuItemId: string;
  variantId: string | null;
  name: TranslatedText;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
  lineNote: string | null;
}

/** Name snapshot in the guest's locale plus the restaurant default locale (so staff and guest both read it). */
function snapshotName(name: TranslatedText, locale: string, defaultLocale: string): TranslatedText {
  const snapshot: Record<string, string> = {};
  for (const key of [defaultLocale, locale]) {
    const value = resolveText(name, key, defaultLocale);
    if (value) snapshot[key] = value;
  }
  return snapshot as TranslatedText;
}

/** Validate every line against the live menu and snapshot what the guest sees; prices are never taken from input. */
async function buildLines(restaurant: Restaurant, inputs: CreateOrderInput['items'], locale: string): Promise<LineSnapshot[]> {
  const itemIds = [...new Set(inputs.map((line) => line.itemId))];
  const items = await MenuItem.findAll({
    where: { id: itemIds, restaurantId: restaurant.id },
    include: [
      { model: ItemVariant, as: 'variants' },
      { model: Category, as: 'category', attributes: ['id', 'isHidden'] },
    ],
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const issues: { path: string; message: string; code: string }[] = [];
  const unavailable: string[] = [];
  const now = new Date();

  const lines = inputs.map((line, index): LineSnapshot | null => {
    const item = byId.get(line.itemId);
    if (!item || item.category?.isHidden) {
      issues.push({ path: `items.${index}.itemId`, message: 'Unknown menu item', code: 'custom' });
      return null;
    }
    if (!isEffectivelyAvailable(item.isAvailable, item.unavailableUntil, now)) {
      unavailable.push(item.id);
      return null;
    }
    const variants = item.variants ?? [];
    let variant: ItemVariant | null = null;
    if (variants.length > 0) {
      variant = (line.variantId ? variants.find((v) => v.id === line.variantId) : undefined) ?? null;
      if (!variant) {
        issues.push({
          path: `items.${index}.variantId`,
          message: line.variantId ? 'Unknown variant for this item' : 'This item requires a variant',
          code: 'custom',
        });
        return null;
      }
    } else if (line.variantId) {
      issues.push({ path: `items.${index}.variantId`, message: 'This item has no variants', code: 'custom' });
      return null;
    }
    return {
      menuItemId: item.id,
      variantId: variant?.id ?? null,
      name: snapshotName(item.name, locale, restaurant.defaultLocale),
      variantName: variant?.name ?? null,
      unitPriceCents: variant?.priceCents ?? item.priceCents,
      quantity: line.quantity,
      lineNote: line.note ?? null,
    };
  });

  if (issues.length > 0) throw badRequest('Request validation failed', issues);
  if (unavailable.length > 0) {
    throw new AppError(409, 'ITEM_UNAVAILABLE', 'Some items are no longer available', { itemIds: unavailable });
  }
  return lines.filter((line): line is LineSnapshot => line !== null);
}

/** Next daily number for this restaurant; the caller holds a row lock on the restaurant so numbers never collide. */
async function nextOrderNumber(restaurant: Restaurant, now: Date, transaction: Transaction): Promise<number> {
  const dayStart = startOfDayInZone(now, restaurant.timezone);
  const max = await Order.max<number | null, Order>('number', {
    where: { restaurantId: restaurant.id, createdAt: { [Op.gte]: dayStart } },
    transaction,
  });
  return (max ?? 0) + 1;
}

export async function createOrder(slug: string, sessionId: string, input: CreateOrderInput): Promise<PublicOrderDto> {
  const restaurant = await loadPublishedRestaurant(slug);
  if (restaurant.orderingMode !== 'order') throw orderingDisabled();
  if (restaurant.orderingPaused) throw orderingPaused(restaurant);
  const now = new Date();
  const table = await loadOrderingTable(restaurant.id, input.tableNumber, now);

  const locale = pickLocale(input.locale, restaurant.supportedLocales, restaurant.defaultLocale);
  const lines = await buildLines(restaurant, input.items, locale);
  const totalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  const orderId = await sequelize.transaction(async (transaction) => {
    // Serialises order creation per restaurant so the daily number is unique.
    await Restaurant.findByPk(restaurant.id, { attributes: ['id'], transaction, lock: Transaction.LOCK.UPDATE });
    // Counted under the lock so parallel requests from one session cannot exceed the cap.
    const open = await Order.count({
      where: { restaurantId: restaurant.id, sessionId, status: [...OPEN_ORDER_STATUSES] },
      transaction,
    });
    if (open >= ORDERING_LIMITS.maxOpenOrdersPerSession) throw tooManyOpenOrders();
    const number = await nextOrderNumber(restaurant, now, transaction);
    const order = await Order.create(
      {
        restaurantId: restaurant.id,
        tableId: table.id,
        tableNumber: table.number,
        sessionId,
        status: 'new',
        number,
        guestName: input.guestName ?? null,
        note: input.note ?? null,
        totalCents,
        locale,
      },
      { transaction },
    );
    await OrderItem.bulkCreate(
      lines.map((line, index) => ({ orderId: order.id, ...line, sortOrder: index })),
      { transaction },
    );
    return order.id;
  });

  const order = await loadOrder(restaurant.id, orderId);
  publishOrder('order.created', order);
  return toPublicOrderDto(order, restaurant);
}

/** Moves one stale `new` order to `expired` (no-op if somebody accepted it meanwhile). */
export async function expireOrder(restaurantId: string, orderId: string, now = new Date()): Promise<boolean> {
  const [changed] = await Order.update(
    { status: 'expired', closedAt: now },
    { where: { id: orderId, restaurantId, status: 'new' } },
  );
  if (changed === 0) return false;
  publishOrder('order.updated', await loadOrder(restaurantId, orderId));
  return true;
}

function isStale(order: Order, now: Date): boolean {
  return order.status === 'new' && orderExpiresAt(order.createdAt).getTime() <= now.getTime();
}

export async function getPublicOrder(slug: string, sessionId: string, orderId: string): Promise<PublicOrderDto> {
  const restaurant = await loadRestaurantBySlug(slug);
  let order = await loadOrderForSession(restaurant.id, sessionId, orderId);
  // The expiry job runs every minute; a guest polling in between still sees the truthful state.
  if (isStale(order, new Date())) {
    await expireOrder(restaurant.id, order.id);
    order = await loadOrderForSession(restaurant.id, sessionId, orderId);
  }
  return toPublicOrderDto(order, restaurant);
}

export async function cancelOrder(slug: string, sessionId: string, orderId: string): Promise<PublicOrderDto> {
  const restaurant = await loadRestaurantBySlug(slug);
  const order = await loadOrderForSession(restaurant.id, sessionId, orderId);
  if (!canTransitionOrder(order.status, 'cancelled')) throw invalidTransition(order.status, 'cancelled');
  const now = new Date();
  const [changed] = await Order.update(
    { status: 'cancelled', closedAt: now },
    { where: { id: order.id, restaurantId: restaurant.id, status: 'new' } },
  );
  const fresh = await loadOrderForSession(restaurant.id, sessionId, orderId);
  if (changed === 0) throw invalidTransition(fresh.status, 'cancelled');
  publishOrder('order.updated', fresh);
  return toPublicOrderDto(fresh, restaurant);
}

/* ------------------------------------------------------------------ guest: service requests */

export async function createServiceRequest(
  slug: string,
  input: CreateServiceRequestInput,
): Promise<{ request: PublicServiceRequestDto; created: boolean }> {
  const restaurant = await loadPublishedRestaurant(slug);
  if (restaurant.orderingMode === 'off') throw orderingDisabled();
  const now = new Date();
  const table = await loadOrderingTable(restaurant.id, input.tableNumber, now);

  const existing = await ServiceRequest.findOne({
    where: { restaurantId: restaurant.id, tableId: table.id, type: input.type, status: 'open' },
  });
  if (existing) {
    // Re-sending while still open just bumps the time staff see; one card per table and type.
    await sequelize.query('UPDATE service_requests SET updated_at = now() WHERE id = :id', { replacements: { id: existing.id } });
    await existing.reload();
    publishRequest('request.updated', existing);
    return { request: toPublicServiceRequestDto(existing), created: false };
  }
  const request = await ServiceRequest.create({
    restaurantId: restaurant.id,
    tableId: table.id,
    tableNumber: table.number,
    type: input.type,
    status: 'open',
  });
  publishRequest('request.created', request);
  return { request: toPublicServiceRequestDto(request), created: true };
}

/* ------------------------------------------------------------------ staff */

async function todayStart(restaurantId: string, now: Date): Promise<Date> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['timezone'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return startOfDayInZone(now, restaurant.timezone);
}

export async function listOrders(restaurantId: string, query: ListOrdersQuery, now = new Date()): Promise<OrderDto[]> {
  const where: WhereOptions<Order> = { restaurantId };
  const since = query.since ? new Date(query.since) : null;
  if (query.status) {
    Object.assign(where, { status: query.status, ...(since ? { createdAt: { [Op.gte]: since } } : {}) });
  } else if (since) {
    Object.assign(where, { createdAt: { [Op.gte]: since } });
  } else {
    // Default board: whatever still needs attention plus everything from today.
    Object.assign(where, {
      [Op.or]: [{ status: [...OPEN_ORDER_STATUSES] }, { createdAt: { [Op.gte]: await todayStart(restaurantId, now) } }],
    });
  }
  const orders = await Order.findAll({ where, include: [ITEMS_INCLUDE], order: ORDER_SORT });
  return orders.map(toOrderDto);
}

export async function getOrder(restaurantId: string, orderId: string): Promise<OrderDto> {
  return toOrderDto(await loadOrder(restaurantId, orderId));
}

export async function setOrderStatus(
  restaurantId: string,
  orderId: string,
  input: UpdateOrderStatusInput,
  now = new Date(),
): Promise<OrderDto> {
  const order = await loadOrder(restaurantId, orderId);
  if (!canTransitionOrder(order.status, input.status)) throw invalidTransition(order.status, input.status);

  const patch =
    input.status === 'accepted'
      ? { status: input.status, acceptedAt: now }
      : input.status === 'delivered'
        ? { status: input.status, deliveredAt: now, closedAt: now }
        : { status: input.status, rejectedReason: input.rejectedReason ?? null, closedAt: now };

  // Conditional on the status we read, so two waiters tapping at once cannot both "win".
  const [changed] = await Order.update(patch, { where: { id: order.id, restaurantId, status: order.status } });
  const fresh = await loadOrder(restaurantId, orderId);
  if (changed === 0) throw invalidTransition(fresh.status, input.status);
  publishOrder('order.updated', fresh);
  return toOrderDto(fresh);
}

export async function listServiceRequests(
  restaurantId: string,
  query: ListServiceRequestsQuery,
  now = new Date(),
): Promise<ServiceRequestDto[]> {
  const where: WhereOptions<ServiceRequest> = { restaurantId };
  const since = query.since ? new Date(query.since) : null;
  if (query.status) {
    Object.assign(where, { status: query.status, ...(since ? { createdAt: { [Op.gte]: since } } : {}) });
  } else if (since) {
    Object.assign(where, { createdAt: { [Op.gte]: since } });
  } else {
    Object.assign(where, { [Op.or]: [{ status: 'open' }, { createdAt: { [Op.gte]: await todayStart(restaurantId, now) } }] });
  }
  const requests = await ServiceRequest.findAll({ where, order: [['createdAt', 'ASC']] });
  return requests.map(toServiceRequestDto);
}

/** Marks a request done; idempotent so two staff phones can both tap "Done". */
export async function completeServiceRequest(restaurantId: string, requestId: string, now = new Date()): Promise<ServiceRequestDto> {
  const request = await ServiceRequest.findOne({ where: { id: requestId, restaurantId } });
  if (!request) throw notFound('Request not found');
  if (request.status === 'done') return toServiceRequestDto(request);
  await request.update({ status: 'done', doneAt: now });
  publishRequest('request.updated', request);
  return toServiceRequestDto(request);
}

/* ------------------------------------------------------------------ expiry job */

/** Every `new` order older than ORDERING_LIMITS.expiryMinutes becomes `expired`; returns how many changed. */
export async function expireStaleOrders(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ORDERING_LIMITS.expiryMinutes * 60_000);
  const stale = await Order.findAll({
    where: { status: 'new', createdAt: { [Op.lt]: cutoff } },
    attributes: ['id', 'restaurantId'],
  });
  let expired = 0;
  for (const order of stale) {
    if (await expireOrder(order.restaurantId, order.id, now)) expired += 1;
  }
  if (expired > 0) logger.info({ expired }, 'Expired stale orders');
  return expired;
}
