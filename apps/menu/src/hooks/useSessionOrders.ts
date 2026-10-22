import { useSyncExternalStore } from 'react';
import { readSessionOrders, subscribeSessionOrders, type SessionOrder } from '../lib/orders';

/** Orders placed in this tab session (newest first); re-renders when one is placed or its status changes. */
export function useSessionOrders(tenantKey: string): SessionOrder[] {
  return useSyncExternalStore(subscribeSessionOrders, () => readSessionOrders(tenantKey));
}
