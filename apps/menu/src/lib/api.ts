import {
  publicMenuDtoSchema,
  type PublicEventInput,
  type PublicMenuDto,
  type PublicOrderDto,
  type PublicServiceRequestDto,
  type ServiceRequestType,
} from '@qr-menu/shared';
import type { Dictionary } from './i18n';
import { getSessionId } from './session';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

/**
 * In dev the browser talks to the Vite origin (proxied, Host preserved). Production builds call VITE_API_URL
 * directly; when it is empty the API is expected on the same origin (reverse proxy in front of both).
 */
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** True when the menu and the API share an origin (dev proxy, or production behind one reverse proxy). */
export const API_SAME_ORIGIN = API_BASE === '';

function publicUrl(slug: string | null, path: string): URL {
  const base = slug ? `${API_BASE}/api/public/${encodeURIComponent(slug)}` : `${API_BASE}/api/public`;
  return new URL(`${base}/${path}`, window.location.origin);
}

async function request<T>(url: URL, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new NetworkError(error);
  }

  if (!response.ok) {
    let code = 'HTTP_ERROR';
    let message = response.statusText || `Request failed with status ${response.status}`;
    let details: unknown;
    try {
      const body = (await response.json()) as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null;
      if (body?.error && typeof body.error.code === 'string') {
        code = body.error.code;
        if (typeof body.error.message === 'string') message = body.error.message;
        details = body.error.details;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, code, message, details);
  }
  return (await response.json()) as T;
}

export async function fetchMenu(slug: string | null, locale: string | undefined, signal?: AbortSignal): Promise<PublicMenuDto> {
  const url = publicUrl(slug, 'menu');
  if (locale) url.searchParams.set('locale', locale);
  const data = await request<PublicMenuDto>(url, { signal, headers: { Accept: 'application/json' } });
  if (import.meta.env.DEV) {
    // Dev-only contract check; stripped from production builds together with zod.
    const check = publicMenuDtoSchema.safeParse(data);
    if (!check.success) console.warn('[tabla] /menu payload does not match PublicMenuDto', check.error.issues);
  }
  return data;
}

/** Fire-and-forget analytics; never throws, never awaited by the UI. */
export function postEvent(slug: string | null, input: PublicEventInput): void {
  try {
    void fetch(publicUrl(slug, 'events').toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ ordering (needs the session id) */

/** What the cart sends; prices and the total are computed by the API. Matches `createOrderSchema`. */
export interface OrderPayload {
  tableNumber: number;
  items: { itemId: string; variantId?: string; quantity: number; note?: string }[];
  note?: string;
  guestName?: string;
  locale: string;
}

function sessionHeaders(): Record<string, string> {
  return { Accept: 'application/json', 'X-Session-Id': getSessionId() };
}

function jsonInit(method: 'POST', body?: unknown): RequestInit {
  return {
    method,
    headers: { ...sessionHeaders(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

export function createOrder(slug: string | null, payload: OrderPayload): Promise<PublicOrderDto> {
  return request<PublicOrderDto>(publicUrl(slug, 'orders'), jsonInit('POST', payload));
}

export function fetchOrder(slug: string | null, orderId: string, signal?: AbortSignal): Promise<PublicOrderDto> {
  return request<PublicOrderDto>(publicUrl(slug, `orders/${encodeURIComponent(orderId)}`), { signal, headers: sessionHeaders() });
}

export function cancelOrder(slug: string | null, orderId: string): Promise<PublicOrderDto> {
  return request<PublicOrderDto>(publicUrl(slug, `orders/${encodeURIComponent(orderId)}/cancel`), jsonInit('POST'));
}

export function createServiceRequest(
  slug: string | null,
  type: ServiceRequestType,
  tableNumber: number,
): Promise<PublicServiceRequestDto> {
  return request<PublicServiceRequestDto>(publicUrl(slug, 'requests'), jsonInit('POST', { type, tableNumber }));
}

export type MenuErrorKind = 'network' | 'not-published' | 'not-found' | 'error';

export function menuErrorKind(error: unknown): MenuErrorKind {
  if (error instanceof ApiError) {
    if (error.code === 'MENU_NOT_PUBLISHED') return 'not-published';
    if (error.status === 404) return 'not-found';
    return 'error';
  }
  return 'network';
}

/** Guest-facing copy for a failed order / call. `ORDERING_PAUSED` carries the venue's own message. */
export function orderingErrorMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'TABLE_BLOCKED':
        return t.errors.blocked;
      case 'ORDERING_PAUSED':
        return error.message && error.message !== 'Ordering is paused right now' ? error.message : t.errors.paused;
      case 'ITEM_UNAVAILABLE':
        return t.errors.unavailable;
      case 'TOO_MANY_OPEN_ORDERS':
        return t.errors.tooMany;
      case 'TABLE_NOT_FOUND':
        return t.errors.tableNotFound;
      case 'ORDERING_DISABLED':
      case 'MENU_NOT_PUBLISHED':
        return t.errors.disabled;
      case 'RATE_LIMITED':
        return t.errors.rateLimited;
      default:
        return t.errors.generic;
    }
  }
  if (error instanceof NetworkError) return t.errors.network;
  return t.errors.generic;
}
