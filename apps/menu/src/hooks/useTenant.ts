import { useEffect, useMemo } from 'react';
import { API_SAME_ORIGIN } from '../lib/api';
import type { UiLocale } from '../lib/i18n';
import { readCachedTenant, resolveTenant, tenantKeyFor, writeCachedTenant, type CachedTenant } from '../lib/tenant';
import { applyTheme } from '../lib/theme';

/** Which restaurant this page is for, the storage key for it, and the header essentials we remembered last time. */
export function useTenant(pathSlug: string | undefined) {
  const tenant = useMemo(() => resolveTenant(pathSlug), [pathSlug]);
  const tenantKey = useMemo(() => tenantKeyFor(tenant.slug), [tenant]);
  // Host-derived slug + same-origin API → host-based URLs (/api/public/menu), the form the HTML preloads.
  const slug = tenant.source === 'host' && API_SAME_ORIGIN ? null : tenant.slug;
  const cachedTenant = useMemo(() => readCachedTenant(tenantKey), [tenantKey]);
  return { tenant, tenantKey, slug, cachedTenant };
}

/** Apply the venue's theme + accent as soon as the menu is known and remember it for the next visit. */
export function useTenantTheme(restaurant: (CachedTenant & { theme: string }) | null, tenantKey: string): void {
  useEffect(() => {
    if (!restaurant) return;
    applyTheme(restaurant.theme, restaurant.primaryColor, restaurant.backgroundColor);
    writeCachedTenant(tenantKey, restaurant);
  }, [restaurant, tenantKey]);
}

export function useDocumentLang(locale: UiLocale): void {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
}
