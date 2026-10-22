import type { ReactNode } from 'react';
import type { OrderDto, ServiceRequestDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { clock, formatPrice, minutesUntil, relativeTime, text } from '../../lib/format';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { PaymentChip } from './PaymentChip';

export type GroupTone = 'amber' | 'accent' | 'green';
const BADGE: Record<GroupTone, string> = {
  amber: 'bg-[#FEF3C7] text-[#92400E]',
  accent: 'bg-accent text-on-accent',
  green: 'bg-[#DCFCE7] text-[#166534]',
};

export function CountBadge({ tone, children, className }: { tone: GroupTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums', BADGE[tone], className)}>
      {children}
    </span>
  );
}

export function GroupHeading({ id, title, count, tone }: { id: string; title: string; count: number; tone: GroupTone }) {
  return (
    <h2 id={id} className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
      {title}
      <CountBadge tone={tone}>{count}</CountBadge>
    </h2>
  );
}

interface CallCardProps {
  request: ServiceRequestDto;
  now: Date;
  busy: boolean;
  compact: boolean;
  onDone: () => void;
}

/** One open call ("Calls the waiter" / "Asks for the bill") with its Done button. */
export function CallCard({ request, now, busy, compact, onDone }: CallCardProps) {
  const label = request.type === 'bill' ? 'Asks for the bill' : 'Calls the waiter';
  return (
    <article aria-label={`Table ${request.tableNumber}: ${label}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface py-3 pl-3.5 pr-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#FEF3C7] text-[#92400E]" aria-hidden="true">
        <Icon name={request.type === 'bill' ? 'receipt' : 'bell'} size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold">Table {request.tableNumber}</div>
        <div className="text-[13px] text-muted">
          {label} · {relativeTime(request.updatedAt, now)}
        </div>
      </div>
      <Button size={compact ? 'md' : 'xl'} className="font-semibold" onClick={onDone} loading={busy}>
        Done
      </Button>
    </article>
  );
}

function Lines({ order, currency, defaultLocale }: { order: OrderDto; currency: string; defaultLocale: string }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Items">
      {order.items.map((line) => (
        <li key={line.id} className="flex items-baseline gap-2.5 text-sm">
          <span className="min-w-[26px] font-semibold tabular-nums">{line.quantity}×</span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{text(line.name, defaultLocale)}</span>
            {line.variantName ? <span className="text-muted"> · {line.variantName}</span> : null}
            {line.lineNote ? <span className="block text-[13px] italic text-accent">“{line.lineNote}”</span> : null}
          </span>
          <span className="text-[13px] tabular-nums text-muted">{formatPrice(line.lineTotalCents, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

function OrderHeader({ order, right, currency, payments }: { order: OrderDto; right: ReactNode; currency: string; payments: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base font-semibold">#{order.number}</span>
      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-line-2 px-2.5 text-xs font-semibold">Table {order.tableNumber}</span>
      {payments ? <PaymentChip order={order} currency={currency} /> : null}
      {order.guestName ? <span className="truncate text-[13px] text-muted">{order.guestName}</span> : null}
      <span className="ml-auto shrink-0 text-xs tabular-nums">{right}</span>
    </div>
  );
}

interface NewOrderCardProps {
  order: OrderDto;
  currency: string;
  defaultLocale: string;
  now: Date;
  busy: boolean;
  compact: boolean;
  /** Payments module on: show the payment chip. */
  payments?: boolean;
  onAccept: () => void;
  onReject: () => void;
}

/** A `new` order waiting for a waiter: accent edge, expiry countdown, Reject / Accept. */
export function NewOrderCard({ order, currency, defaultLocale, now, busy, compact, payments = false, onAccept, onReject }: NewOrderCardProps) {
  const minutes = order.expiresAt ? minutesUntil(order.expiresAt, now) : null;
  return (
    <article
      aria-label={`Order #${order.number}, table ${order.tableNumber}`}
      className="flex flex-col gap-3 rounded-[14px] border border-line border-l-[3px] border-l-accent bg-surface px-3.5 pb-3 pt-3.5"
    >
      <OrderHeader order={order} currency={currency} payments={payments} right={<span className="text-muted">{relativeTime(order.createdAt, now)}</span>} />
      <Lines order={order} currency={currency} defaultLocale={defaultLocale} />
      {order.note ? <div className="rounded-lg border border-line-2 bg-canvas px-3 py-2 text-[13px] italic text-ink-2">“{order.note}”</div> : null}
      <div className="flex items-center justify-between border-t border-line-2 pt-2.5">
        <span className={cn('text-xs', minutes !== null && minutes <= 5 ? 'text-danger-text' : 'text-muted')}>
          {minutes === null ? '' : minutes > 0 ? `expires in ${minutes} min` : 'expiring…'}
        </span>
        <span className="text-base font-semibold tabular-nums">{formatPrice(order.totalCents, currency)}</span>
      </div>
      <div className="flex gap-2">
        <Button size={compact ? 'md' : 'xl'} className="flex-1 font-semibold" onClick={onReject} disabled={busy}>
          Reject
        </Button>
        <Button variant="primary" size={compact ? 'md' : 'xl'} className="flex-[2]" onClick={onAccept} loading={busy}>
          Accept
        </Button>
      </div>
    </article>
  );
}

interface InProgressCardProps {
  order: OrderDto;
  currency: string;
  defaultLocale: string;
  busy: boolean;
  compact: boolean;
  /** Payments module on: show the chip and, while unpaid, the "Cash" button. */
  payments?: boolean;
  onDeliver: () => void;
  onCash?: () => void;
}

/** An accepted order being prepared: one button, Delivered. */
export function InProgressCard({ order, currency, defaultLocale, busy, compact, payments = false, onDeliver, onCash }: InProgressCardProps) {
  return (
    <article aria-label={`Order #${order.number}, table ${order.tableNumber}`} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface px-3.5 pb-3 pt-3.5">
      <OrderHeader order={order} currency={currency} payments={payments} right={<span className="text-[#166534]">accepted {order.acceptedAt ? clock(order.acceptedAt) : ''}</span>} />
      <Lines order={order} currency={currency} defaultLocale={defaultLocale} />
      <div className="flex items-center justify-between gap-3 border-t border-line-2 pt-2.5">
        <span className="text-base font-semibold tabular-nums">{formatPrice(order.totalCents, currency)}</span>
        <span className="flex items-center gap-2">
          {payments && onCash && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'failed' || order.paymentStatus === 'pending') ? (
            <Button size={compact ? 'md' : 'xl'} onClick={onCash} disabled={busy} aria-label={`Cash for #${order.number}`}>
              Cash
            </Button>
          ) : null}
          <Button variant="primary" size={compact ? 'md' : 'xl'} icon={<Icon name="check" size={16} strokeWidth={2} />} onClick={onDeliver} loading={busy}>
            Delivered
          </Button>
        </span>
      </div>
    </article>
  );
}
