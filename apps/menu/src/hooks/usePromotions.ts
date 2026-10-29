import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PublicPromotionDto } from '@qr-menu/shared';
import { fetchPromotions } from '../lib/api';
import { MENU_STALE_MS } from './useMenu';

const NONE: PublicPromotionDto[] = [];

/** The venue's active promotions, in the menu's locale; a failure simply shows none. */
export function usePromotions(slug: string | null, tenantKey: string, locale: string | undefined, enabled: boolean): PublicPromotionDto[] {
  const query = useQuery({
    queryKey: ['promotions', tenantKey, locale ?? ''] as const,
    queryFn: ({ signal }) => fetchPromotions(slug, locale, signal),
    staleTime: MENU_STALE_MS,
    placeholderData: keepPreviousData,
    retry: 1,
    enabled,
  });
  return query.data ?? NONE;
}
