import type { OrderDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

/**
 * Fiscal receipt state of a paid order (Phase 9d, POS module). A failed fiscalisation never blocks the paid state:
 * the card says so and offers Retry; the waiter can always issue the receipt at the register by hand.
 */
export function FiscalChip({ order, busy, onRetry, className }: { order: OrderDto; busy?: boolean; onRetry?: () => void; className?: string }) {
  if (order.fiscalStatus === 'none') return null;
  if (order.fiscalStatus === 'issued') {
    return (
      <span data-fiscal="issued" className={cn('inline-flex h-6 items-center rounded-full bg-[#DCFCE7] px-2.5 text-xs font-semibold text-[#166534]', className)} title={order.fiscalInvoiceNumber ?? undefined}>
        Fiscal receipt {order.fiscalInvoiceNumber ? `· ${order.fiscalInvoiceNumber.slice(-8)}` : 'issued'}
      </span>
    );
  }
  if (order.fiscalStatus === 'pending') {
    return (
      <span data-fiscal="pending" className={cn('inline-flex h-6 items-center rounded-full bg-[#FEF3C7] px-2.5 text-xs font-semibold text-[#92400E]', className)}>
        Fiscal receipt pending…
      </span>
    );
  }
  return (
    <span data-fiscal="failed" className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <span className="inline-flex h-6 items-center rounded-full bg-[#FEE2E2] px-2.5 text-xs font-semibold text-[#991B1B]" title={order.fiscalError ?? undefined}>
        Fiscal receipt pending — issue it at the register
      </span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry} loading={busy} aria-label={`Retry fiscal receipt for #${order.number}`}>
          Retry
        </Button>
      ) : null}
    </span>
  );
}
