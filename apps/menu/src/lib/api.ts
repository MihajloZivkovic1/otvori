import { publicMenuDtoSchema, type PublicEventInput, type PublicMenuDto } from '@qr-menu/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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

function publicUrl(slug: string | null, resource: 'menu' | 'events'): URL {
  const path = slug
    ? `${API_BASE}/api/public/${encodeURIComponent(slug)}/${resource}`
    : `${API_BASE}/api/public/${resource}`;
  return new URL(path, window.location.origin);
}

export async function fetchMenu(slug: string | null, locale: string | undefined, signal?: AbortSignal): Promise<PublicMenuDto> {
  const url = publicUrl(slug, 'menu');
  if (locale) url.searchParams.set('locale', locale);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new NetworkError(error);
  }

  if (!response.ok) {
    let code = 'HTTP_ERROR';
    let message = response.statusText || `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } } | null;
      if (body?.error && typeof body.error.code === 'string') {
        code = body.error.code;
        if (typeof body.error.message === 'string') message = body.error.message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, code, message);
  }

  const data = (await response.json()) as PublicMenuDto;
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

export type MenuErrorKind = 'network' | 'not-published' | 'not-found' | 'error';

export function menuErrorKind(error: unknown): MenuErrorKind {
  if (error instanceof ApiError) {
    if (error.code === 'MENU_NOT_PUBLISHED') return 'not-published';
    if (error.status === 404) return 'not-found';
    return 'error';
  }
  return 'network';
}
