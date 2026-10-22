import type { OrderDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/format';

const LABEL: Record<OrderDto['paymentStatus'], string> = {
  unpaid: 'Unpaid',
  pending: 'Paying…',
  paid: 'Paid · IPS',
  failed: 'Payment failed',
  cash: 'Cash',
};

const TONE: Record<OrderDto['paymentStatus'], string> = {
  unpaid: 'bg-line-2 text-ink-2',
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  paid: 'bg-[#DCFCE7] text-[#166534]',
  failed: 'bg-[#FEE2E2] text-[#991B1B]',
  cash: 'bg-[#DCFCE7] text-[#166534]',
};

/** Payment state of an order on the waiter screen (Phase 9c); paid-online chips carry the tip. */
export function PaymentChip({ order, currency, className }: { order: OrderDto; currency: string; className?: string }) {
  const tip = order.paymentStatus === 'paid' && order.tipCents > 0 ? ` · tip ${formatPrice(order.tipCents, currency)}` : '';
  return (
    <span
      data-payment={order.paymentStatus}
      className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold', TONE[order.paymentStatus], className)}
    >
      {LABEL[order.paymentStatus]}
      {tip}
    </span>
  );
}
