import { PAYMENT_LIMITS } from '@qr-menu/shared';
import { logger } from '../../utils/logger.js';
import { reconcilePendingPayments } from './service.js';

/**
 * Once a minute, polls the provider for pending attempts older than two minutes (a missed webhook) and expires the
 * ones whose QR is no longer valid. In-process like the order expiry job: one API instance only.
 */
export function startPaymentReconcileJob(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { checked, changed } = await reconcilePendingPayments();
      if (changed > 0) logger.info({ checked, changed }, 'Reconciled pending payments');
    } catch (error) {
      logger.error({ err: error }, 'Payment reconciliation job failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), PAYMENT_LIMITS.reconcileIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
