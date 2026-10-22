import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { canPayOrder, isFinalOrderStatus, type OrderStatus, type PublicOrderDto } from '@qr-menu/shared';
import { TableChip } from '../components/Chips';
import { BackIcon, CheckIcon } from '../components/icons';
import { FiscalReceipt } from '../components/FiscalReceipt';
import { OfflineScreen } from '../components/OfflineScreen';
import { Toast } from '../components/Toast';
import { useMenu } from '../hooks/useMenu';
import { useServiceCalls } from '../hooks/useServiceCalls';
import { useSessionOrders } from '../hooks/useSessionOrders';
import { useDocumentLang, useTenant, useTenantTheme } from '../hooks/useTenant';
import { useToast } from '../hooks/useToast';
import { ApiError, cancelOrder, fetchOrder, orderingErrorMessage } from '../lib/api';
import { addLine, writeCart, type CartLine } from '../lib/cart';
import { formatPrice, formatTime } from '../lib/format';
import { dict, type Dictionary, type UiLocale } from '../lib/i18n';
import { requestedLocale, resolveUiLocale } from '../lib/locale';
import { rememberOrder } from '../lib/orders';
import { menuPath, orderPath } from '../lib/routes';

// Online payment sheet (Phase 9c): its own chunk, loaded when the guest taps "Pay by phone".
const PaymentSheet = lazy(() => import('../components/PaymentSheet').then((module) => ({ default: module.PaymentSheet })));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POLL_MS = 5_000;

/** Which progress step is current: 0 sent, 1 accepted, 3 = everything done; null = no progress bar. */
function stepOf(status: OrderStatus): number | null {
  if (status === 'new') return 0;
  if (status === 'accepted') return 1;
  if (status === 'delivered') return 3;
  return null;
}

const TITLE_TONE: Record<OrderStatus, string> = {
  new: 'text-ink',
  accepted: 'text-ok',
  delivered: 'text-ok',
  rejected: 'text-bad',
  expired: 'text-muted',
  cancelled: 'text-muted',
};

const PRIMARY = 'flex h-12 items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold text-on-accent no-underline';
const SECONDARY = 'flex h-12 items-center justify-center rounded-[14px] border border-line text-[15px] font-semibold text-ink disabled:opacity-60';

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Steps({ status, t }: { status: OrderStatus; t: Dictionary }) {
  const current = stepOf(status);
  if (current === null) return null;
  return (
    <ol className="grid grid-cols-3 items-start" aria-label={t.order}>
      {t.steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const reached = done || active;
        return (
          <li key={label} className="relative flex flex-col items-center gap-2">
            <span className={`absolute top-[9px] left-0 h-0.5 w-1/2 ${index === 0 ? '' : index <= current ? 'bg-accent' : 'bg-line'}`} aria-hidden="true" />
            <span className={`absolute top-[9px] right-0 h-0.5 w-1/2 ${index === 2 ? '' : index < current ? 'bg-accent' : 'bg-line'}`} aria-hidden="true" />
            <span
              className={`relative z-10 grid size-5 place-items-center rounded-full border-2 ${
                reached ? 'border-accent bg-accent' : 'border-line bg-surface'
              } ${active && status !== 'delivered' ? 'pulse-dot' : ''}`}
              aria-hidden="true"
            >
              {done && <CheckIcon width={10} height={10} className="text-on-accent" strokeWidth={2.6} />}
            </span>
            <span className={`text-center text-xs font-medium ${reached ? 'text-ink' : 'text-muted'}`}>
              {label}
              {active && <span className="sr-only"> (current)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Loading({ t }: { t: Dictionary }) {
  return (
    <div role="status" aria-busy="true" aria-label={t.loading} className="mx-auto min-h-dvh max-w-[640px]">
      <div className="safe-top flex flex-col gap-6 px-5">
        <div className="skeleton h-5 w-16" />
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-36 w-full rounded-[18px]" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-5 w-3/4" />
      </div>
    </div>
  );
}

/** /order/:id — the guest's live view of one order (design A4); polls every 5 s until a final state. */
export function OrderPage() {
  const { slug: pathSlug, orderId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantKey, slug, cachedTenant } = useTenant(pathSlug);

  const requested = requestedLocale(searchParams);
  const menu = useMenu(slug, tenantKey, requested);
  const restaurant = menu.data?.restaurant ?? null;
  const locale: UiLocale = resolveUiLocale(requested, restaurant);
  const t = dict[locale];
  useDocumentLang(locale);
  useTenantTheme(restaurant, tenantKey);

  const queryKey = ['order', tenantKey, orderId] as const;
  const order = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchOrder(slug, orderId, signal),
    enabled: UUID_RE.test(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isFinalOrderStatus(status) ? false : POLL_MS;
    },
    refetchOnWindowFocus: true,
    retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status < 500),
  });
  useEffect(() => {
    if (order.data) rememberOrder(tenantKey, order.data);
  }, [order.data, tenantKey]);

  const sessionOrders = useSessionOrders(tenantKey);
  const calls = useServiceCalls(slug, tenantKey, t);
  const [toast, showToast] = useToast();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [paying, setPaying] = useState(false);
  const onPaid = useCallback(() => void order.refetch(), [order]);

  const cancel = useMutation({
    mutationFn: () => cancelOrder(slug, orderId),
    onSuccess: (updated: PublicOrderDto) => {
      queryClient.setQueryData(queryKey, updated);
      rememberOrder(tenantKey, updated);
      setConfirmingCancel(false);
    },
    onError: (error) => {
      showToast(orderingErrorMessage(error, t), 'error');
      setConfirmingCancel(false);
      void order.refetch();
    },
  });

  const orderAgain = (data: PublicOrderDto) => {
    let lines: CartLine[] = [];
    for (const line of data.items) {
      if (!line.menuItemId) continue;
      const next = addLine(lines, { itemId: line.menuItemId, variantId: line.variantId, quantity: line.quantity, note: line.lineNote ?? '' });
      if (next) lines = next;
    }
    writeCart(tenantKey, lines);
    void navigate(`${menuPath(pathSlug)}?cart=1`);
  };

  const callWaiter = async (tableNumber: number) => {
    const result = await calls.call('call_waiter', tableNumber);
    if (!result.ok) showToast(result.message, 'error');
  };

  const venueName = restaurant?.name ?? cachedTenant?.name ?? null;
  const back = menuPath(pathSlug);

  if (!order.data) {
    if (order.isError && !(order.error instanceof ApiError && order.error.status === 404)) {
      return <OfflineScreen kind="network" t={t} tenant={cachedTenant} onRetry={() => void order.refetch()} retrying={order.isFetching} />;
    }
    if (order.isError || !UUID_RE.test(orderId)) {
      return (
        <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
          <title>{`${t.order} · otvori`}</title>
          <main className="flex flex-1 flex-col items-center justify-center gap-3.5 px-10 py-10 text-center">
            <h1 className="font-serif text-[22px] leading-[1.25] font-bold text-pretty">{t.orderNotFound}</h1>
            <p className="max-w-[280px] text-[15px] leading-[1.5] text-muted text-pretty">{t.orderNotFoundBody}</p>
            <Link to={back} className={`${PRIMARY} mt-2 px-6`}>
              {t.backToMenu}
            </Link>
          </main>
        </div>
      );
    }
    return <Loading t={t} />;
  }

  const data = order.data;
  const copy = t.status[data.status];
  const currency = data.currency;
  const polling = !isFinalOrderStatus(data.status);
  const earlier = sessionOrders.filter((known) => known.id !== data.id);
  const waiterCooldown = calls.remaining.call_waiter;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      <title>{`${t.order} #${data.number} · ${venueName ?? 'otvori'}`}</title>
      <div className="safe-top flex flex-1 flex-col gap-[22px] px-5 pb-8">
        <div className="flex items-center justify-between gap-3">
          <Link to={back} className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-ink no-underline">
            <BackIcon />
            {t.menu}
          </Link>
          <TableChip label={`${t.table} ${data.tableNumber}`} />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[28px] leading-[1.15] font-bold">
            {t.order} #{data.number}
          </h1>
          <p className="text-[13px] text-muted">
            {t.sentAt} {formatTime(data.createdAt, locale)}
            {venueName ? ` · ${venueName}` : ''}
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-[18px]" aria-live="polite">
          <div className="flex flex-col gap-1">
            <h2 className={`font-serif text-xl leading-[1.25] font-bold text-pretty ${TITLE_TONE[data.status]}`}>{copy.title}</h2>
            <p className="text-[13.5px] leading-[1.5] text-muted text-pretty">{copy.body}</p>
          </div>
          <Steps status={data.status} t={t} />
          {data.status === 'rejected' && data.rejectedReason && (
            <p className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-[1.45] text-bad text-pretty">
              <span className="font-semibold">{t.reason}:</span> {data.rejectedReason}
            </p>
          )}
          {polling && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className="pulse-dot size-1.5 rounded-full bg-muted" aria-hidden="true" />
              {t.autoRefresh}
            </p>
          )}
        </section>

        <div>
          <ul>
            {data.items.map((line) => (
              <li key={line.id} className="flex items-baseline gap-3 border-b border-line py-[11px]">
                <span className="min-w-[26px] text-sm font-semibold text-muted tabular-nums">{line.quantity}×</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-serif text-[15px] leading-[1.3]">{line.name}</span>
                  {line.variantName && <span className="text-[12.5px] text-muted">{line.variantName}</span>}
                  {line.lineNote && <span className="text-[12.5px] text-muted italic">“{line.lineNote}”</span>}
                </span>
                <span className="text-sm font-medium tabular-nums">{formatPrice(line.lineTotalCents, currency, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between pt-3.5">
            <span className="text-[13px] font-semibold text-muted">{t.total}</span>
            <span className="text-xl font-bold tabular-nums">{formatPrice(data.totalCents, currency, locale)}</span>
          </div>
          {data.note && <p className="mt-1.5 text-[12.5px] leading-[1.45] text-muted italic">“{data.note}”</p>}
        </div>

        {data.paymentStatus === 'paid' && <FiscalReceipt slug={slug} order={data} t={t} />}

        <div className="mt-auto flex flex-col gap-2.5">
          {data.payments.enabled && canPayOrder(data) && (
            <button type="button" onClick={() => setPaying(true)} className={PRIMARY}>
              {t.pay.payByPhone}
            </button>
          )}
          {(data.paymentStatus === 'paid' || data.paymentStatus === 'cash') && (
            <p className="flex items-center justify-center gap-2 rounded-[14px] bg-ok-soft px-4 py-3 text-[15px] font-semibold text-ok" role="status">
              <CheckIcon width={16} height={16} strokeWidth={2.6} />
              {data.paymentStatus === 'cash' ? t.pay.paidCash : t.pay.paid}
              {data.paymentStatus === 'paid' && data.tipCents > 0 && (
                <span className="font-medium">· {t.pay.paidWithTip(formatPrice(data.tipCents, currency, locale))}</span>
              )}
            </p>
          )}
          {data.status === 'new' &&
            (confirmingCancel ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setConfirmingCancel(false)} className={SECONDARY} disabled={cancel.isPending}>
                  {t.keepOrder}
                </button>
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="flex h-12 items-center justify-center rounded-[14px] bg-bad-soft text-[15px] font-semibold text-bad disabled:opacity-60"
                >
                  {t.confirmCancel}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingCancel(true)} className={SECONDARY}>
                {t.cancelOrder}
              </button>
            ))}
          {(data.status === 'rejected' || data.status === 'expired' || data.status === 'cancelled') && (
            <>
              <button type="button" onClick={() => orderAgain(data)} className={PRIMARY}>
                {t.orderAgain}
              </button>
              <button type="button" onClick={() => void callWaiter(data.tableNumber)} disabled={waiterCooldown > 0} className={`${SECONDARY} tabular-nums`}>
                {waiterCooldown > 0 ? `${t.called} · ${countdown(waiterCooldown)}` : t.callWaiter}
              </button>
            </>
          )}
          {data.status === 'delivered' && (
            <Link to={back} className={data.payments.enabled && canPayOrder(data) ? SECONDARY : PRIMARY}>
              {t.backToMenu}
            </Link>
          )}
        </div>

        {earlier.length > 0 && (
          <section className="flex flex-col gap-1.5 pt-1.5" aria-labelledby="earlier-orders">
            <h2 id="earlier-orders" className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              {t.earlierOrders}
            </h2>
            {earlier.map((known) => (
              <Link
                key={known.id}
                to={orderPath(pathSlug, known.id)}
                className="flex h-11 items-center justify-between border-b border-line text-sm font-medium text-ink no-underline"
              >
                <span>
                  #{known.number} · {formatTime(known.createdAt, locale)}
                </span>
                <span className="text-muted">
                  {t.status[known.status].short} · {formatPrice(known.totalCents, currency, locale)}
                </span>
              </Link>
            ))}
          </section>
        )}
      </div>
      {paying && (
        <Suspense fallback={null}>
          <PaymentSheet slug={slug} order={data} locale={locale} t={t} onClose={() => setPaying(false)} onPaid={onPaid} />
        </Suspense>
      )}
      <Toast toast={toast} raised={false} />
    </div>
  );
}
