import type { Order } from '../../db/models/order.model.js';
import { logger } from '../../utils/logger.js';

type PaidOrderHook = (order: Order) => Promise<void>;

const hooks: PaidOrderHook[] = [];

/**
 * Called once per order the moment it becomes paid online (after the row is committed and `order.updated` was
 * published). Phase 9d registers the POS "close order + fiscal receipt" job here; hooks must never throw into the
 * webhook path, so failures are logged and swallowed.
 */
export function onOrderPaid(hook: PaidOrderHook): () => void {
  hooks.push(hook);
  return () => {
    const index = hooks.indexOf(hook);
    if (index >= 0) hooks.splice(index, 1);
  };
}

export async function runPaidOrderHooks(order: Order): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook(order);
    } catch (error) {
      logger.error({ err: error, orderId: order.id }, 'Paid-order hook failed');
    }
  }
}

const cashHooks: PaidOrderHook[] = [];

/** Called once when staff mark an order as paid in cash (ESIR mode fiscalises cash sales too). */
export function onOrderCash(hook: PaidOrderHook): () => void {
  cashHooks.push(hook);
  return () => {
    const index = cashHooks.indexOf(hook);
    if (index >= 0) cashHooks.splice(index, 1);
  };
}

export async function runCashOrderHooks(order: Order): Promise<void> {
  for (const hook of cashHooks) {
    try {
      await hook(order);
    } catch (error) {
      logger.error({ err: error, orderId: order.id }, 'Cash-order hook failed');
    }
  }
}
