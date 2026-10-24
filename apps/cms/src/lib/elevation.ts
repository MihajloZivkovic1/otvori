import type { ElevationDto, ElevationWindow } from '@qr-menu/shared';

/**
 * Owner-PIN elevation per venue (Phase 11): the short-lived token the API hands out after the keypad, sent as
 * `X-Elevation` on owner requests. Kept in memory and mirrored to sessionStorage, so a reload within the window
 * stays unlocked while closing the tab locks the device.
 */
export interface Elevation {
  token: string;
  /** ISO. */
  expiresAt: string;
  window: ElevationWindow;
}

const KEY = (rid: string) => `tabla.cms.elevation.${rid}`;
const memory = new Map<string, Elevation>();
const listeners = new Set<() => void>();

function readStored(rid: string): Elevation | null {
  try {
    const raw = sessionStorage.getItem(KEY(rid));
    return raw ? (JSON.parse(raw) as Elevation) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export const elevationStore = {
  /** The current, unexpired elevation for a venue, or null. */
  get(rid: string, now = Date.now()): Elevation | null {
    const current = memory.get(rid) ?? readStored(rid);
    if (!current) return null;
    if (new Date(current.expiresAt).getTime() <= now) {
      elevationStore.clear(rid);
      return null;
    }
    memory.set(rid, current);
    return current;
  },
  set(rid: string, elevation: Elevation): void {
    memory.set(rid, elevation);
    try {
      sessionStorage.setItem(KEY(rid), JSON.stringify(elevation));
    } catch {
      // ignore
    }
    notify();
  },
  setFromDto(dto: ElevationDto): void {
    elevationStore.set(dto.restaurantId, { token: dto.token, expiresAt: dto.expiresAt, window: dto.window });
  },
  clear(rid: string): void {
    memory.delete(rid);
    try {
      sessionStorage.removeItem(KEY(rid));
    } catch {
      // ignore
    }
    notify();
  },
  clearAll(): void {
    for (const rid of [...memory.keys()]) memory.delete(rid);
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('tabla.cms.elevation.')) sessionStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    notify();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** `/api/admin/restaurants/<rid>/…` → rid; anything else → null. */
export function restaurantIdFromPath(path: string): string | null {
  const match = /^\/api\/admin\/restaurants\/([0-9a-f-]{36})(?:\/|$|\?)/i.exec(path);
  return match?.[1] ?? null;
}

/**
 * Installed by the ElevationProvider of the venue on screen: asked to open the keypad when the API answers
 * 403 PIN_REQUIRED; resolves true once the device is unlocked, false when the person cancels.
 */
type ElevationHandler = (rid: string) => Promise<boolean>;
let handler: ElevationHandler | null = null;

export function setElevationHandler(next: ElevationHandler | null): void {
  handler = next;
}

export function requestElevation(rid: string): Promise<boolean> {
  return handler ? handler(rid) : Promise.resolve(false);
}
