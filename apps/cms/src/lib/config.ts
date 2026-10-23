import { useQuery } from '@tanstack/react-query';
import { DEFAULT_FEATURE_FLAGS, type AppConfigDto, type FeatureFlags } from '@qr-menu/shared';
import { api } from './api';

export const appConfigKey = ['appConfig'] as const;

/**
 * GET /api/config (Phase 10): the deployment's global feature flags, read once at startup and kept for the session.
 * Until it answers — or if it fails — the shared defaults apply (payments off, POS on), which is also what the API
 * enforces on its side, so the UI can only ever be *more* conservative than the server.
 */
export function useAppConfig(): { features: FeatureFlags; version: string | null } {
  const query = useQuery({
    queryKey: appConfigKey,
    queryFn: () => api<AppConfigDto>('/api/config', { auth: false }),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  return { features: query.data?.features ?? DEFAULT_FEATURE_FLAGS, version: query.data?.version ?? null };
}
