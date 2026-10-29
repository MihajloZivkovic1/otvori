import type { AuthResponseDto } from '@qr-menu/shared';
import { elevationStore, requestElevation, restaurantIdFromPath } from './elevation';
import { impersonationStore, renewImpersonation } from './impersonation';

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
 * Dev: the browser talks to the Vite origin (proxied /api, so the refresh cookie is first-party).
 * Production: VITE_API_URL, or the same origin when it is empty (reverse proxy in front of both).
 */
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/* ------------------------------------------------------------------ access token (memory only) */

let accessToken: string | null = null;
const tokenListeners = new Set<() => void>();

export const tokenStore = {
  get: (): string | null => accessToken,
  set(token: string | null): void {
    accessToken = token;
    tokenListeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    tokenListeners.add(listener);
    return () => tokenListeners.delete(listener);
  },
};

let unauthorizedHandler: (() => void) | null = null;
/** Called once the refresh token is gone too: the auth provider drops the session and the router shows /login. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/* ------------------------------------------------------------------ refresh (single flight) */

let refreshing: Promise<AuthResponseDto | null> | null = null;

/** POST /api/auth/refresh using the httpOnly cookie. Resolves null when there is no valid session. */
export function refreshSession(): Promise<AuthResponseDto | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        tokenStore.set(null);
        return null;
      }
      const session = (await response.json()) as AuthResponseDto;
      tokenStore.set(session.accessToken);
      return session;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/* ------------------------------------------------------------------ requests */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** false for public auth endpoints: no bearer token, no refresh-and-retry on 401. */
  auth?: boolean;
  headers?: Record<string, string>;
}

async function parseError(response: Response): Promise<ApiError> {
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
    // non-JSON body
  }
  return new ApiError(response.status, code, message, details);
}

async function send(path: string, init: RequestInit, auth: boolean, allowRetry: boolean, allowUnlock = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  const rid = auth ? restaurantIdFromPath(path) : null;
  // "Open as owner" (Phase 13): requests to the impersonated venue carry the venue-scoped token instead; it acts
  // as the owner without a PIN, so no elevation header goes with it.
  const impersonation = rid ? impersonationStore.get(rid) : null;
  if (impersonation) headers.set('Authorization', `Bearer ${impersonation.token}`);
  else if (auth && token) headers.set('Authorization', `Bearer ${token}`);
  // Owner PIN (Phase 11): owner requests carry the device's elevation token for that venue.
  const elevation = rid && !impersonation ? elevationStore.get(rid) : null;
  if (elevation) headers.set('X-Elevation', elevation.token);
  else headers.delete('X-Elevation');

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new NetworkError(error);
  }

  if (response.status === 401 && auth) {
    // A wrong PIN or a wrong password confirmation is a 401 too, but it is about the credential just typed, not
    // about the session: hand it to the caller instead of refreshing or signing out.
    const code = await peekErrorCode(response);
    if (code === 'PIN_INVALID' || code === 'INVALID_CREDENTIALS') return response;
    // An expired impersonation token says nothing about the superadmin's own session: ask for a fresh one and
    // replay, otherwise hand the 401 to the caller (the venue layout shows "Back to admin").
    if (impersonation && rid) {
      impersonationStore.clear();
      if (allowRetry && (await renewImpersonation(rid))) return send(path, init, auth, false, allowUnlock);
      return response;
    }
    if (allowRetry) {
      const session = await refreshSession();
      if (session) return send(path, init, auth, false, allowUnlock);
    }
    tokenStore.set(null);
    unauthorizedHandler?.();
  }

  // 403 PIN_REQUIRED: the venue has an owner PIN and this device is locked. Ask the keypad once; if the owner
  // unlocks, replay the very same request with the fresh token. Cancelling leaves the 403 for the caller.
  if (response.status === 403 && auth && rid && allowUnlock) {
    const code = await peekErrorCode(response);
    if (code === 'PIN_REQUIRED') {
      elevationStore.clear(rid);
      if (await requestElevation(rid)) return send(path, init, auth, allowRetry, false);
    }
  }
  return response;
}

async function peekErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { error?: { code?: unknown } } | null;
    return typeof body?.error?.code === 'string' ? body.error.code : null;
  } catch {
    return null;
  }
}

/** JSON request against the API; 401 → one refresh + retry; 204 → undefined. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  const init: RequestInit = { method, signal, headers };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await send(path, init, auth, true);
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Binary GET (QR images, the PDF sheet) with the same auth handling. */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await send(path, { method: 'GET', signal }, true, true);
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

/** multipart/form-data upload of one image (the API accepts any field name). */
export function apiUpload<T>(path: string, file: Blob, filename: string): Promise<T> {
  const form = new FormData();
  form.append('image', file, filename);
  return api<T>(path, { method: 'POST', body: form });
}

/** Human-readable message for toasts. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
      const first = error.details[0] as { message?: string } | undefined;
      if (first?.message) return first.message;
    }
    return error.message || fallback;
  }
  if (error instanceof NetworkError) return 'You appear to be offline';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
