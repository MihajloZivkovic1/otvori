import { POS_LIMITS } from '@qr-menu/shared';
import { logger } from '../../utils/logger.js';
import { onOrderAccepted } from '../ordering/hooks.js';
import { onOrderCash, onOrderPaid } from '../payments/hooks.js';
import { onOrderAcceptedForPos, onOrderCashForPos, onOrderPaidForPos, runDuePosJobs } from './service.js';

let registered = false;

/** Wires the order lifecycle into the POS queue (once per process; `createApp()` may run several times in tests). */
export function registerPosHooks(): void {
  if (registered) return;
  registered = true;
  onOrderAccepted(onOrderAcceptedForPos);
  onOrderPaid(onOrderPaidForPos);
  onOrderCash(onOrderCashForPos);
}

/** Polls the persistent queue every 10 s; one API instance only (jobs are claimed with SKIP LOCKED anyway). */
export function startPosQueue(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDuePosJobs();
    } catch (error) {
      logger.error({ err: error }, 'POS queue tick failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), POS_LIMITS.pollMs);
  timer.unref();
  return () => clearInterval(timer);
}
