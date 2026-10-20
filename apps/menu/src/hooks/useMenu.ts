import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchMenu } from '../lib/api';

export const MENU_STALE_MS = 30_000;

export function menuQueryKey(tenantKey: string, locale: string | undefined) {
  return ['menu', tenantKey, locale ?? ''] as const;
}

/** The public menu for this tenant in the requested locale (undefined = restaurant default). */
export function useMenu(slug: string | null, tenantKey: string, locale: string | undefined) {
  return useQuery({
    queryKey: menuQueryKey(tenantKey, locale),
    queryFn: ({ signal }) => fetchMenu(slug, locale, signal),
    staleTime: MENU_STALE_MS,
    // Keep the previous locale's menu on screen while the new one loads (no skeleton flash on SR/EN).
    placeholderData: keepPreviousData,
  });
}
