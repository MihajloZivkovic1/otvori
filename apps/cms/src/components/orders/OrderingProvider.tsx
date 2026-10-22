import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { effectiveOrderingMode, isOpenOrderStatus, type OrderDto, type OrderingEvent, type RestaurantDto, type ServiceRequestDto } from '@qr-menu/shared';
import { apiUrl } from '../../lib/api';
import { text } from '../../lib/format';
import { notifyInBackground, playAlertSound, vibrate } from '../../lib/notify';
import { fetchSseToken, upsertOrder, upsertRequest, useOrders, useServiceRequests } from '../../lib/queries';
import { ordersMuted } from '../../lib/storage';

export interface OrderingCounts {
  calls: number;
  newOrders: number;
  inProgress: number;
  /** new + in progress. */
  open: number;
  /** Nav badge: new orders + open calls. */
  badge: number;
}

export interface OrderingContextValue {
  /** False while the ordering module is off or the venue's orderingMode is `off` (nothing is fetched, no stream). */
  enabled: boolean;
  orders: OrderDto[];
  requests: ServiceRequestDto[];
  loading: boolean;
  error: unknown;
  counts: OrderingCounts;
  /** True while the SSE stream is open; otherwise the lists poll every 10 s. */
  connected: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  refetch: () => void;
}

const ZERO: OrderingCounts = { calls: 0, newOrders: 0, inProgress: 0, open: 0, badge: 0 };
const DISABLED: OrderingContextValue = {
  enabled: false,
  orders: [],
  requests: [],
  loading: false,
  error: null,
  counts: ZERO,
  connected: false,
  muted: false,
  setMuted: () => undefined,
  refetch: () => undefined,
};

const OrderingContext = createContext<OrderingContextValue>(DISABLED);

/** Live orders/calls for the current venue; outside the provider (or with ordering off) everything is empty. */
export function useOrdering(): OrderingContextValue {
  return useContext(OrderingContext);
}

/** Polling cadence while the stream is down. */
export const POLL_MS = 10_000;
/** The API pings every 25 s; two missed pings mean the stream is dead even if the socket looks open. */
const PING_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

export function OrderingProvider({ restaurant, children }: { restaurant: RestaurantDto; children: ReactNode }) {
  // Without the ordering module (or with the mode off) the whole ordering UI is absent: nav item, badge, cards, actions.
  if (effectiveOrderingMode(restaurant) === 'off') return <OrderingContext.Provider value={DISABLED}>{children}</OrderingContext.Provider>;
  return <LiveOrdering restaurant={restaurant}>{children}</LiveOrdering>;
}

function LiveOrdering({ restaurant, children }: { restaurant: RestaurantDto; children: ReactNode }) {
  const rid = restaurant.id;
  const client = useQueryClient();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [muted, setMutedState] = useState(() => ordersMuted.get());
  const mutedRef = useRef(muted);
  const restaurantRef = useRef(restaurant);

  useEffect(() => {
    mutedRef.current = muted;
    restaurantRef.current = restaurant;
  }, [muted, restaurant]);

  const setMuted = useCallback((next: boolean) => {
    ordersMuted.set(next);
    setMutedState(next);
  }, []);

  const ordersQuery = useOrders(rid, true, connected ? false : POLL_MS);
  const requestsQuery = useServiceRequests(rid, true, connected ? false : POLL_MS);
  const refetch = useCallback(() => {
    void ordersQuery.refetch();
    void requestsQuery.refetch();
  }, [ordersQuery, requestsQuery]);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  /* ------------------------------------------------------------------ SSE with reconnect */

  useEffect(() => {
    if (typeof EventSource === 'undefined') return; // old browsers / tests: polling only

    let source: EventSource | null = null;
    let closed = false;
    let attempt = 0;
    let timer: number | null = null;
    let lastPing = Date.now();

    const alert = (title: string, body: string, tag: string) => {
      if (!mutedRef.current) playAlertSound();
      vibrate();
      notifyInBackground(title, body, tag, () => void navigate(`/r/${rid}/orders`));
    };

    const handle = (event: OrderingEvent) => {
      lastPing = Date.now();
      const venue = restaurantRef.current;
      switch (event.type) {
        case 'order.created': {
          upsertOrder(client, rid, event.order);
          const summary = event.order.items.map((line) => `${line.quantity}× ${text(line.name, venue.defaultLocale)}`).join(', ');
          alert(`New order #${event.order.number} · Table ${event.order.tableNumber}`, summary, `order-${event.order.id}`);
          break;
        }
        case 'order.updated':
          upsertOrder(client, rid, event.order);
          break;
        case 'request.created':
          upsertRequest(client, rid, event.request);
          alert(
            `Table ${event.request.tableNumber} ${event.request.type === 'bill' ? 'asks for the bill' : 'calls the waiter'}`,
            venue.name,
            `request-${event.request.id}`,
          );
          break;
        case 'request.updated':
          upsertRequest(client, rid, event.request);
          break;
        case 'ping':
          break;
      }
    };

    const schedule = () => {
      if (closed || timer !== null) return;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
      attempt += 1;
      timer = window.setTimeout(() => {
        timer = null;
        void connect();
      }, delay);
    };

    const drop = () => {
      source?.close();
      source = null;
      setConnected(false);
    };

    const connect = async () => {
      if (closed) return;
      let token: string;
      try {
        token = (await fetchSseToken(rid)).token;
      } catch {
        schedule();
        return;
      }
      if (closed) return;
      const stream = new EventSource(apiUrl(`/api/admin/restaurants/${rid}/events?token=${encodeURIComponent(token)}`));
      source = stream;
      stream.addEventListener('open', () => {
        attempt = 0;
        lastPing = Date.now();
        setConnected(true);
        refetchRef.current(); // catch up on anything that happened while we were disconnected
      });
      stream.addEventListener('error', () => {
        if (source !== stream) return;
        drop();
        schedule();
      });
      const parse = (message: MessageEvent<string>) => {
        try {
          handle(JSON.parse(message.data) as OrderingEvent);
        } catch {
          // malformed event: ignore
        }
      };
      for (const type of ['order.created', 'order.updated', 'request.created', 'request.updated', 'ping'] as const) {
        stream.addEventListener(type, parse as EventListener);
      }
    };

    const watchdog = window.setInterval(() => {
      if (source && Date.now() - lastPing > PING_TIMEOUT_MS) {
        drop();
        schedule();
      }
    }, 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);

    void connect();
    return () => {
      closed = true;
      window.clearInterval(watchdog);
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      drop();
    };
  }, [client, navigate, rid]);

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const counts = useMemo<OrderingCounts>(() => {
    const calls = requests.filter((request) => request.status === 'open').length;
    const newOrders = orders.filter((order) => order.status === 'new').length;
    const inProgress = orders.filter((order) => order.status === 'accepted').length;
    return { calls, newOrders, inProgress, open: orders.filter((order) => isOpenOrderStatus(order.status)).length, badge: newOrders + calls };
  }, [orders, requests]);

  const value = useMemo<OrderingContextValue>(
    () => ({
      enabled: true,
      orders,
      requests,
      loading: ordersQuery.isPending || requestsQuery.isPending,
      error: ordersQuery.error ?? requestsQuery.error,
      counts,
      connected,
      muted,
      setMuted,
      refetch,
    }),
    [orders, requests, ordersQuery.isPending, ordersQuery.error, requestsQuery.isPending, requestsQuery.error, counts, connected, muted, setMuted, refetch],
  );

  return <OrderingContext.Provider value={value}>{children}</OrderingContext.Provider>;
}
