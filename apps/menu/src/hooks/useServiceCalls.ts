import { useCallback, useEffect, useState } from 'react';
import { ORDERING_LIMITS, SERVICE_REQUEST_TYPES, type ServiceRequestType } from '@qr-menu/shared';
import { createServiceRequest, orderingErrorMessage } from '../lib/api';
import type { Dictionary } from '../lib/i18n';
import { readLastCall, writeLastCall } from '../lib/orders';

export type CallResult = { ok: true } | { ok: false; message: string };
type LastCalls = Record<ServiceRequestType, number | null>;

const COOLDOWN_MS = ORDERING_LIMITS.callCooldownSeconds * 1000;

function readAll(tenantKey: string): LastCalls {
  return Object.fromEntries(SERVICE_REQUEST_TYPES.map((type) => [type, readLastCall(tenantKey, type)])) as LastCalls;
}

function secondsLeft(lastAt: number | null, now: number): number {
  if (!lastAt) return 0;
  return Math.max(0, Math.ceil((lastAt + COOLDOWN_MS - now) / 1000));
}

/**
 * "Call the waiter" / "The bill": one request per type, then a 60 s cooldown (persisted per tab session so a
 * reload does not re-arm the button). `remaining[type]` counts down once a second while a cooldown runs.
 */
export function useServiceCalls(slug: string | null, tenantKey: string, t: Dictionary) {
  const [lastCalls, setLastCalls] = useState<LastCalls>(() => readAll(tenantKey));
  const [now, setNow] = useState(() => Date.now());
  const ticking = SERVICE_REQUEST_TYPES.some((type) => secondsLeft(lastCalls[type], now) > 0);

  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const call = useCallback(
    async (type: ServiceRequestType, tableNumber: number): Promise<CallResult> => {
      try {
        await createServiceRequest(slug, type, tableNumber);
      } catch (error) {
        return { ok: false, message: orderingErrorMessage(error, t) };
      }
      const at = Date.now();
      writeLastCall(tenantKey, type, at);
      setLastCalls((prev) => ({ ...prev, [type]: at }));
      setNow(at);
      return { ok: true };
    },
    [slug, t, tenantKey],
  );

  const remaining = Object.fromEntries(
    SERVICE_REQUEST_TYPES.map((type) => [type, secondsLeft(lastCalls[type], now)]),
  ) as Record<ServiceRequestType, number>;

  return { remaining, call };
}
