import { useSyncExternalStore } from 'react';
import type { ImpersonationDto } from '@qr-menu/shared';

/**
 * "Open as owner" (Phase 13): the short-lived, venue-scoped token a superadmin gets from
 * POST /api/superadmin/restaurants/:id/impersonate. While one is held, every request to that venue's admin routes
 * carries it instead of the superadmin's own token, and the venue shell shows the banner. Mirrored to
 * sessionStorage so a reload keeps the session; closing the tab ends it.
 */
export interface Impersonation {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  token: string;
  /** ISO. */
  expiresAt: string;
  owner: { id: string; name: string; email: string } | null;
}

const KEY = 'tabla.cms.impersonation';
let current: Impersonation | null | undefined;
const listeners = new Set<() => void>();

function readStored(): Impersonation | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Impersonation) : null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export const impersonationStore = {
  /** The active impersonation (any venue), or null. Expired ones are dropped on read. */
  current(now = Date.now()): Impersonation | null {
    if (current === undefined) current = readStored();
    if (current && new Date(current.expiresAt).getTime() <= now) impersonationStore.clear();
    return current ?? null;
  },
  /** The active impersonation for this venue, or null. */
  get(restaurantId: string, now = Date.now()): Impersonation | null {
    const active = impersonationStore.current(now);
    return active && active.restaurantId === restaurantId ? active : null;
  },
  setFromDto(dto: ImpersonationDto): void {
    current = {
      restaurantId: dto.restaurant.id,
      restaurantName: dto.restaurant.name,
      slug: dto.restaurant.slug,
      token: dto.token,
      expiresAt: dto.expiresAt,
      owner: dto.owner,
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // ignore
    }
    notify();
  },
  clear(): void {
    current = null;
    try {
      sessionStorage.removeItem(KEY);
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

/** The active impersonation, re-rendering when it starts or ends. */
export function useImpersonation(): Impersonation | null {
  return useSyncExternalStore(impersonationStore.subscribe, () => impersonationStore.current(), () => null);
}

/**
 * Installed by the venue layout while a superadmin is inside a venue: asked by the API client when the
 * impersonation token is refused (expired), it fetches a new one and resolves true, so the request is replayed.
 */
type RenewHandler = (restaurantId: string) => Promise<boolean>;
let renew: RenewHandler | null = null;

export function setImpersonationRenewHandler(handler: RenewHandler | null): void {
  renew = handler;
}

export function renewImpersonation(restaurantId: string): Promise<boolean> {
  return renew ? renew(restaurantId) : Promise.resolve(false);
}
