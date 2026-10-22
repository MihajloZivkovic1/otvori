import { logger } from '../../utils/logger.js';
import { expireStaleOrders } from './service.js';

const INTERVAL_MS = 60_000;

/**
 * Once a minute, moves `new` orders nobody accepted within 20 minutes to `expired` (and notifies the waiter
 * screens through the event bus). In-process like the SSE bus: with several API instances only one should run it.
 */
export function startOrderExpiryJob(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await expireStaleOrders();
    } catch (error) {
      logger.error({ err: error }, 'Order expiry job failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
