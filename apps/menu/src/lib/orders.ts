import { isOpenOrderStatus, type OrderStatus, type PublicOrderDto, type ServiceRequestType } from '@qr-menu/shared';

/** What the menu remembers about orders placed in this tab session (for the header link and "earlier orders"). */
export interface SessionOrder {
  id: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
}

const ORDERS_PREFIX = 'tabla.orders.';
const CALL_PREFIX = 'tabla.call.';
const MAX_REMEMBERED = 10;

const listeners = new Set<() => void>();
let cache: { key: string; raw: string | null; value: SessionOrder[] } | null = null;
const EMPTY: SessionOrder[] = [];

function isSessionOrder(value: unknown): value is SessionOrder {
  const order = value as Partial<SessionOrder> | null;
  return (
    typeof order?.id === 'string' &&
    typeof order.number === 'number' &&
    typeof order.status === 'string' &&
    typeof order.totalCents === 'number' &&
    typeof order.createdAt === 'string'
  );
}

/** Newest first. Returns the same array while storage is unchanged (so it can back useSyncExternalStore). */
export function readSessionOrders(tenantKey: string): SessionOrder[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(ORDERS_PREFIX + tenantKey);
  } catch {
    // storage unavailable
  }
  if (cache && cache.key === tenantKey && cache.raw === raw) return cache.value;
  let value = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      value = Array.isArray(parsed) ? parsed.filter(isSessionOrder) : EMPTY;
    } catch {
      value = EMPTY;
    }
  }
  cache = { key: tenantKey, raw, value };
  return value;
}

/** Insert or update one order and notify subscribers. */
export function rememberOrder(tenantKey: string, order: PublicOrderDto): void {
  const entry: SessionOrder = {
    id: order.id,
    number: order.number,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
  };
  const rest = readSessionOrders(tenantKey).filter((known) => known.id !== order.id);
  const next = [entry, ...rest]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_REMEMBERED);
  try {
    sessionStorage.setItem(ORDERS_PREFIX + tenantKey, JSON.stringify(next));
  } catch {
    // storage unavailable
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSessionOrders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openOrderCount(orders: readonly SessionOrder[]): number {
  return orders.filter((order) => isOpenOrderStatus(order.status)).length;
}

/* ------------------------------------------------------------------ call-waiter cooldown */

export function readLastCall(tenantKey: string, type: ServiceRequestType): number | null {
  try {
    const value = Number(sessionStorage.getItem(`${CALL_PREFIX}${tenantKey}.${type}`));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeLastCall(tenantKey: string, type: ServiceRequestType, at: number): void {
  try {
    sessionStorage.setItem(`${CALL_PREFIX}${tenantKey}.${type}`, String(at));
  } catch {
    // ignore
  }
}
