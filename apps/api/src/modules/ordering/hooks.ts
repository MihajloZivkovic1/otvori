import type { Order } from '../../db/models/order.model.js';
import { logger } from '../../utils/logger.js';

type OrderHook = (order: Order) => Promise<void>;

const accepted: OrderHook[] = [];

/** Called once when staff accept an order (after the row is committed and `order.updated` was published). */
export function onOrderAccepted(hook: OrderHook): () => void {
  accepted.push(hook);
  return () => {
    const index = accepted.indexOf(hook);
    if (index >= 0) accepted.splice(index, 1);
  };
}

export async function runAcceptedHooks(order: Order): Promise<void> {
  for (const hook of accepted) {
    try {
      await hook(order);
    } catch (error) {
      logger.error({ err: error, orderId: order.id }, 'Accepted-order hook failed');
    }
  }
}
