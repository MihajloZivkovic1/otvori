import { useState } from 'react';
import type { OrderDto, OrderStatus } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { clock, formatPrice, plural } from '../../lib/format';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { FiscalChip } from './FiscalChip';
import { PaymentChip } from './PaymentChip';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  accepted: 'In progress',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
};
const STATUS_TONE: Record<OrderStatus, string> = {
  new: 'text-ink',
  accepted: 'text-ink',
  delivered: 'text-[#166534]',
  rejected: 'text-[#991B1B]',
  cancelled: 'text-muted',
  expired: 'text-muted',
};

interface TodayHistoryProps {
  /** Closed orders of the day, newest first. */
  orders: OrderDto[];
  /** Today's order count (cancelled ones excluded) and ordered total (accepted + delivered). */
  count: number;
  totalCents: number;
  currency: string;
  /** Payments module on: chips per row and "Cash" on delivered-but-unpaid orders. */
  payments?: boolean;
  onCash?: (order: OrderDto) => void;
  pos?: boolean;
  onRetryFiscal?: (order: OrderDto) => void;
  onFiscalManual?: (order: OrderDto) => void;
}

/** Collapsed "Today" row with the day's totals; expands to the closed orders and a status breakdown. */
export function TodayHistory({ orders, count, totalCents, currency, payments = false, onCash, pos = false, onRetryFiscal, onFiscalManual }: TodayHistoryProps) {
  const [open, setOpen] = useState(false);
  const tally = (status: OrderStatus) => orders.filter((order) => order.status === status).length;
  const breakdown = [
    `${tally('delivered')} delivered`,
    tally('rejected') ? `${tally('rejected')} rejected` : null,
    tally('expired') ? `${tally('expired')} expired` : null,
    tally('cancelled') ? `${tally('cancelled')} cancelled` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label="Today">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[52px] w-full cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-surface px-4 text-left text-ink"
      >
        <span className="text-sm font-semibold">Today</span>
        <span className="ml-auto text-[13px] text-muted">
          {plural(count, 'order', 'orders')} · {formatPrice(totalCents, currency)}
        </span>
        <Icon name="chevronDown" size={16} strokeWidth={1.8} className={cn('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="mt-2 overflow-hidden rounded-[14px] border border-line bg-surface">
          {orders.length === 0 ? <div className="px-3.5 py-4 text-[13px] text-muted">Nothing closed yet today.</div> : null}
          {orders.map((order) => (
            <div key={order.id} className="flex h-12 items-center gap-2.5 border-b border-line-2 px-3.5 text-[13px]">
              <span className="font-semibold">#{order.number}</span>
              <span className="text-muted">Table {order.tableNumber}</span>
              <span className={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</span>
              {payments && order.status === 'delivered' ? <PaymentChip order={order} currency={currency} className="h-5 text-[11px]" /> : null}
              {pos && order.paymentStatus === 'paid' ? <FiscalChip order={order} onRetry={onRetryFiscal ? () => onRetryFiscal(order) : undefined} onManual={onFiscalManual ? () => onFiscalManual(order) : undefined} className="text-[11px]" /> : null}
              {payments && onCash && order.status === 'delivered' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'cash' ? (
                <Button size="sm" onClick={() => onCash(order)} aria-label={`Cash for #${order.number}`}>
                  Cash
                </Button>
              ) : null}
              <span className="ml-auto tabular-nums text-muted">{clock(order.closedAt ?? order.createdAt)}</span>
              <span className="min-w-[72px] text-right tabular-nums">{formatPrice(order.totalCents, currency)}</span>
            </div>
          ))}
          <div className="flex h-11 items-center justify-between px-3.5 text-[13px] text-muted">
            <span>{breakdown}</span>
            <span className="font-semibold text-ink">{formatPrice(totalCents, currency)}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
