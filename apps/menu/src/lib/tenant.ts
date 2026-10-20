import { RESTAURANT_DEFAULTS } from '@qr-menu/shared';

/**
 * Which restaurant is this page for?
 *   1. /r/:slug path (dev / fallback)            → slug
 *   2. host subdomain (kafeterija.salveta.menu, kafeterija.localhost) → slug
 *   3. VITE_DEFAULT_SLUG (dev convenience on plain localhost)       → slug
 *   4. nothing → null: the API resolves the restaurant from the Host header (/api/public/menu).
 * When the slug came from the host and the API is same-origin, requests also use the host-based URL so they
 * match the <link rel="preload"> emitted by the build (see vite.config.ts).
 */
export function slugFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  const labels = host.split('.');
  // "salveta.menu" is an apex domain, "kafeterija.localhost" is a tenant.
  if (labels.length < 2 || (labels.length === 2 && labels[1] !== 'localhost')) return null;
  const first = labels[0]!;
  if (first === 'www' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(first)) return null;
  return first;
}

export function pathSlugFromLocation(pathname: string): string | undefined {
  const match = /^\/r\/([^/]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

export type TenantSource = 'path' | 'host' | 'env';
export interface ResolvedTenant {
  slug: string | null;
  /** Where the slug came from; null when the API has to resolve it from the Host header. */
  source: TenantSource | null;
}

export function resolveTenant(pathSlug: string | undefined, hostname = window.location.hostname): ResolvedTenant {
  if (pathSlug) return { slug: pathSlug, source: 'path' };
  const fromHost = slugFromHost(hostname);
  if (fromHost) return { slug: fromHost, source: 'host' };
  const fromEnv = import.meta.env.VITE_DEFAULT_SLUG?.trim();
  if (fromEnv) return { slug: fromEnv, source: 'env' };
  return { slug: null, source: null };
}

/** Storage key component for the current tenant (slug, or the host when the API resolves it). */
export function tenantKeyFor(slug: string | null, hostname = window.location.hostname): string {
  return slug ?? `host:${hostname.toLowerCase()}`;
}

/** The header essentials we remember per tenant so the skeleton and offline screens are branded instantly. */
export interface CachedTenant {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  theme: string;
}

const CACHE_PREFIX = 'tabla.tenant.';

export function readCachedTenant(tenantKey: string): CachedTenant | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_PREFIX + tenantKey) ?? 'null') as Partial<CachedTenant> | null;
    if (!value || typeof value.name !== 'string' || !value.name) return null;
    return {
      name: value.name,
      logoUrl: typeof value.logoUrl === 'string' ? value.logoUrl : null,
      primaryColor: typeof value.primaryColor === 'string' ? value.primaryColor : RESTAURANT_DEFAULTS.primaryColor,
      theme: typeof value.theme === 'string' ? value.theme : RESTAURANT_DEFAULTS.theme,
    };
  } catch {
    return null;
  }
}

export function writeCachedTenant(tenantKey: string, { name, logoUrl, primaryColor, theme }: CachedTenant): void {
  try {
    localStorage.setItem(CACHE_PREFIX + tenantKey, JSON.stringify({ name, logoUrl, primaryColor, theme }));
  } catch {
    // storage unavailable (private mode / quota) — purely a nicety
  }
}
