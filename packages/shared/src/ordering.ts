import { ORDERING_LIMITS, type OrderStatus } from './constants.js';

/**
 * Legal order status transitions. Guests may only cancel while the order is `new`; staff accept/reject/deliver;
 * the expiry job moves stale `new` orders to `expired`. Final states never change again.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  new: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['delivered', 'rejected'],
  delivered: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Orders that still need staff attention; also the ones that count against the per-session limit. */
export const OPEN_ORDER_STATUSES = ['new', 'accepted'] as const satisfies readonly OrderStatus[];

/** Statuses staff may set through PATCH /orders/:id. */
export const STAFF_ORDER_STATUSES = ['accepted', 'delivered', 'rejected'] as const satisfies readonly OrderStatus[];
export type StaffOrderStatus = (typeof STAFF_ORDER_STATUSES)[number];

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return (OPEN_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** When a `new` order expires if nobody accepts it. */
export function orderExpiresAt(createdAt: Date | string): Date {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return new Date(created.getTime() + ORDERING_LIMITS.expiryMinutes * 60_000);
}

export function orderTotalCents(lines: ReadonlyArray<{ unitPriceCents: number; quantity: number }>): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}
