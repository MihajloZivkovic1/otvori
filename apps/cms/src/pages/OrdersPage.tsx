import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { isFinalOrderStatus, type OrderDto, type ServiceRequestDto, type UpdateOrderStatusInput } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { LivePill } from '../components/orders/LivePill';
import { CallCard, CountBadge, GroupHeading, InProgressCard, NewOrderCard, type GroupTone } from '../components/orders/OrderCards';
import { useOrdering } from '../components/orders/OrderingProvider';
import { RejectSheet } from '../components/orders/RejectSheet';
import { TodayHistory } from '../components/orders/TodayHistory';
import { PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useNow } from '../hooks/useNow';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { formatPrice, plural } from '../lib/format';
import { primeAlertSound, requestNotificationPermission } from '../lib/notify';
import { useCompleteRequest, useMarkOrderCash, useRetryFiscal, useUpdateOrderStatus } from '../lib/queries';

/** Waiter screen (design B1–B3, B7): calls, new and in-progress orders, live over SSE with a polling fallback. */
export function OrdersPage() {
  const { restaurant, isMobile } = useRestaurantContext();
  const ordering = useOrdering();
  const navigate = useNavigate();
  if (!ordering.enabled) {
    return (
      <EmptyState
        icon="orders"
        title="Ordering is off"
        description="Turn on “Call the waiter” or guest ordering in Settings. New orders and calls then show up here live, with a sound."
        actions={
          <Button variant="primary" onClick={() => navigate(`/r/${restaurant.id}/settings`)}>
            Open settings
          </Button>
        }
      />
    );
  }
  return isMobile ? <MobileOrders /> : <DesktopOrders />;
}

/* ------------------------------------------------------------------ shared board state */

const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

function useBoard() {
  const { restaurant, hasModule } = useRestaurantContext();
  const ordering = useOrdering();
  const toast = useToast();
  const now = useNow(30_000);
  const update = useUpdateOrderStatus(restaurant.id);
  const markCash = useMarkOrderCash(restaurant.id);
  const retryFiscal = useRetryFiscal(restaurant.id);
  const payments = hasModule('payments');
  const pos = hasModule('pos');
  const complete = useCompleteRequest(restaurant.id);
  const [rejecting, setRejecting] = useState<OrderDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The alert sound and the notification prompt both need a user gesture: take the first tap on this screen.
  useEffect(() => {
    primeAlertSound();
    const once = () => {
      primeAlertSound();
      void requestNotificationPermission();
    };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  }, []);

  const calls = useMemo(() => ordering.requests.filter((request) => request.status === 'open').sort(byCreated), [ordering.requests]);
  const newOrders = useMemo(() => ordering.orders.filter((order) => order.status === 'new').sort(byCreated), [ordering.orders]);
  const inProgress = useMemo(
    () => ordering.orders.filter((order) => order.status === 'accepted').sort((a, b) => (a.acceptedAt ?? '').localeCompare(b.acceptedAt ?? '')),
    [ordering.orders],
  );
  const history = useMemo(
    () => ordering.orders.filter((order) => isFinalOrderStatus(order.status)).sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')),
    [ordering.orders],
  );
  const todayCount = ordering.orders.filter((order) => order.status !== 'cancelled').length;
  const todayTotal = ordering.orders
    .filter((order) => order.status === 'accepted' || order.status === 'delivered')
    .reduce((sum, order) => sum + order.totalCents, 0);

  const onError = (error: unknown) => toast.error(errorMessage(error));
  const setStatus = (order: OrderDto, input: UpdateOrderStatusInput, onSuccess?: () => void) => {
    setBusyId(order.id);
    update.mutate({ id: order.id, input }, { onSuccess, onError, onSettled: () => setBusyId(null) });
  };

  return {
    restaurant,
    ordering,
    payments,
    pos,
    now,
    calls,
    newOrders,
    inProgress,
    history,
    todayCount,
    todayTotal,
    rejecting,
    setRejecting,
    busyId,
    accept: (order: OrderDto) => setStatus(order, { status: 'accepted' }),
    deliver: (order: OrderDto) => setStatus(order, { status: 'delivered' }),
    reject: (order: OrderDto, reason: string) => setStatus(order, { status: 'rejected', rejectedReason: reason }, () => setRejecting(null)),
    done: (request: ServiceRequestDto) => {
      setBusyId(request.id);
      complete.mutate(request.id, { onError, onSettled: () => setBusyId(null) });
    },
    cash: (order: OrderDto) => {
      setBusyId(order.id);
      markCash.mutate(order.id, { onError, onSettled: () => setBusyId(null) });
    },
    retryFiscal: (order: OrderDto) => {
      setBusyId(order.id);
      retryFiscal.mutate(order.id, { onError, onSettled: () => setBusyId(null) });
    },
  };
}
type Board = ReturnType<typeof useBoard>;

function Cards({ board, group, compact }: { board: Board; group: 'calls' | 'new' | 'progress'; compact: boolean }) {
  const { restaurant, now, busyId } = board;
  if (group === 'calls') {
    return board.calls.map((request) => (
      <CallCard key={request.id} request={request} now={now} busy={busyId === request.id} compact={compact} onDone={() => board.done(request)} />
    ));
  }
  if (group === 'new') {
    return board.newOrders.map((order) => (
      <NewOrderCard
        key={order.id}
        order={order}
        currency={restaurant.currency}
        defaultLocale={restaurant.defaultLocale}
        now={now}
        busy={busyId === order.id}
        compact={compact}
        payments={board.payments}
        onAccept={() => board.accept(order)}
        onReject={() => board.setRejecting(order)}
      />
    ));
  }
  return board.inProgress.map((order) => (
    <InProgressCard
      key={order.id}
      order={order}
      currency={restaurant.currency}
      defaultLocale={restaurant.defaultLocale}
      busy={busyId === order.id}
      compact={compact}
      payments={board.payments}
      onDeliver={() => board.deliver(order)}
      onCash={() => board.cash(order)}
      pos={board.pos}
      onRetryFiscal={() => board.retryFiscal(order)}
    />
  ));
}

const GROUPS: { key: 'calls' | 'new' | 'progress'; title: string; tone: GroupTone; empty: string }[] = [
  { key: 'calls', title: 'Calls', tone: 'amber', empty: 'No calls' },
  { key: 'new', title: 'New', tone: 'accent', empty: 'No new orders' },
  { key: 'progress', title: 'In progress', tone: 'green', empty: 'Nothing in progress' },
];

function countOf(board: Board, key: 'calls' | 'new' | 'progress'): number {
  return key === 'calls' ? board.calls.length : key === 'new' ? board.newOrders.length : board.inProgress.length;
}

function MuteButton({ muted, onToggle, size }: { muted: boolean; onToggle: () => void; size: 'icon' | 'text' }) {
  const label = muted ? 'Sound off' : 'Sound on';
  if (size === 'icon') {
    return (
      <IconButton label={label} size={44} variant="outline" aria-pressed={muted} onClick={onToggle} className={cn('rounded-xl', muted ? 'text-faint' : 'text-ink')}>
        <Icon name={muted ? 'muted' : 'sound'} size={18} strokeWidth={1.8} />
      </IconButton>
    );
  }
  return (
    <Button size="sm" aria-pressed={muted} onClick={onToggle} className={muted ? 'text-faint' : ''} icon={<Icon name={muted ? 'muted' : 'sound'} size={14} strokeWidth={1.8} />}>
      {label}
    </Button>
  );
}

function BoardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading orders" className="flex flex-col gap-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <EmptyState
      variant="inline"
      icon="warning"
      title="Could not load orders"
      description={errorMessage(error)}
      actions={
        <Button size="sm" onClick={retry}>
          Try again
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ mobile (B1–B3) */

function MobileOrders() {
  const board = useBoard();
  const { restaurant, ordering } = board;
  const empty = board.calls.length === 0 && board.newOrders.length === 0 && board.inProgress.length === 0;
  const todayChip = (
    <span className="inline-flex h-7 items-center rounded-full border border-line bg-surface px-2.5 text-xs font-medium text-ink-2">
      Today · {plural(board.todayCount, 'order', 'orders')} · {formatPrice(board.todayTotal, restaurant.currency)}
    </span>
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top flex items-end justify-between gap-3 border-b border-line bg-surface px-5 pb-3">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted">{restaurant.name}</div>
          <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-.01em]">Orders</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LivePill connected={ordering.connected} />
          <MuteButton muted={ordering.muted} onToggle={() => ordering.setMuted(!ordering.muted)} size="icon" />
        </div>
      </header>

      {ordering.loading ? (
        <BoardSkeleton />
      ) : ordering.error && empty ? (
        <LoadError error={ordering.error} retry={ordering.refetch} />
      ) : empty ? (
        <EmptyState
          icon="bell"
          title="No open orders"
          description="New orders and calls arrive here live, with a sound. You can keep your phone in your pocket."
          actions={todayChip}
        />
      ) : (
        <div className="flex flex-col gap-5 p-4 pb-6">
          {GROUPS.map((group) =>
            countOf(board, group.key) > 0 ? (
              <section key={group.key} aria-labelledby={`group-${group.key}`} className="flex flex-col gap-2">
                <GroupHeading id={`group-${group.key}`} title={group.title} count={countOf(board, group.key)} tone={group.tone} />
                <Cards board={board} group={group.key} compact={false} />
              </section>
            ) : null,
          )}
          <TodayHistory orders={board.history} count={board.todayCount} totalCents={board.todayTotal} currency={restaurant.currency} payments={board.payments} onCash={board.cash} pos={board.pos} onRetryFiscal={board.retryFiscal} />
        </div>
      )}

      {board.rejecting ? (
        <RejectSheet
          order={board.rejecting}
          defaultLocale={restaurant.defaultLocale}
          isMobile
          loading={board.busyId === board.rejecting.id}
          onClose={() => board.setRejecting(null)}
          onConfirm={(reason) => board.reject(board.rejecting!, reason)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ desktop board (B7) */

function Column({ title, tone, count, empty, id, children }: { title: string; tone: GroupTone; count: number; empty: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-h-0 flex-col gap-2.5">
      <GroupHeading id={id} title={title} count={count} tone={tone} />
      <div className="flex flex-col gap-2 overflow-auto">
        {children}
        {count === 0 ? <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-[13px] text-faint">{empty}</div> : null}
      </div>
    </section>
  );
}

function DesktopOrders() {
  const board = useBoard();
  const { restaurant, ordering } = board;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <PageHeader
        title="Orders"
        subtitle="New orders and calls appear here live; the guest sees every status change on their phone."
        actions={
          <>
            <span className="self-center text-[13px] text-muted">
              Today · {plural(board.todayCount, 'order', 'orders')} · {formatPrice(board.todayTotal, restaurant.currency)}
            </span>
            <LivePill connected={ordering.connected} className="self-center" />
            <MuteButton muted={ordering.muted} onToggle={() => ordering.setMuted(!ordering.muted)} size="text" />
          </>
        }
      />
      {ordering.loading ? (
        <BoardSkeleton />
      ) : (
        <>
          {ordering.error ? <LoadError error={ordering.error} retry={ordering.refetch} /> : null}
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 max-wide:grid-cols-1">
            {GROUPS.map((group) => (
              <Column key={group.key} id={`column-${group.key}`} title={group.title} tone={group.tone} count={countOf(board, group.key)} empty={group.empty}>
                <Cards board={board} group={group.key} compact />
                <CountBadge tone={group.tone} className="sr-only">
                  {countOf(board, group.key)}
                </CountBadge>
              </Column>
            ))}
          </div>
          <TodayHistory orders={board.history} count={board.todayCount} totalCents={board.todayTotal} currency={restaurant.currency} payments={board.payments} onCash={board.cash} pos={board.pos} onRetryFiscal={board.retryFiscal} />
        </>
      )}
      {board.rejecting ? (
        <RejectSheet
          order={board.rejecting}
          defaultLocale={restaurant.defaultLocale}
          isMobile={false}
          loading={board.busyId === board.rejecting.id}
          onClose={() => board.setRejecting(null)}
          onConfirm={(reason) => board.reject(board.rejecting!, reason)}
        />
      ) : null}
    </div>
  );
}
