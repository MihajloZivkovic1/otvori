import { postEvent } from './api';
import { getSessionId } from './session';

const SCAN_PREFIX = 'tabla.scan.';

/** One scan per tab session and table (the API additionally de-duplicates within 30 minutes). */
export function trackScan(slug: string | null, tenantKey: string, tableNumber: number | null): void {
  const key = `${SCAN_PREFIX}${tenantKey}.${tableNumber ?? ''}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // storage unavailable: still report the scan
  }
  postEvent(slug, {
    type: 'scan',
    sessionId: getSessionId(),
    ...(tableNumber ? { tableNumber } : {}),
  });
}

export function trackItemView(slug: string | null, itemId: string): void {
  postEvent(slug, { type: 'item_view', sessionId: getSessionId(), itemId });
}
