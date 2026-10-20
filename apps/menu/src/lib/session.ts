/** Per-tab session id (uuid) for analytics events, plus the table number from the QR code (?t=7). */

const SESSION_KEY = 'tabla.session';
const TABLE_PREFIX = 'tabla.table.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memorySessionId: string | null = null;

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Plain-http LAN hosts (phone testing) have no crypto.randomUUID: build a v4 uuid from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
    const id = uuid();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    memorySessionId ??= uuid();
    return memorySessionId;
  }
}

export function parseTableNumber(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
}

export function readStoredTableNumber(tenantKey: string): number | null {
  try {
    return parseTableNumber(sessionStorage.getItem(TABLE_PREFIX + tenantKey));
  } catch {
    return null;
  }
}

export function storeTableNumber(tenantKey: string, tableNumber: number): void {
  try {
    sessionStorage.setItem(TABLE_PREFIX + tenantKey, String(tableNumber));
  } catch {
    // ignore
  }
}
