import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router';
import { hasModule, moduleAvailable, type FeatureFlags, type MembershipRole, type ModuleKey, type RestaurantDto } from '@qr-menu/shared';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { impersonate, openAsOwner } from '../../lib/admin';
import { ApiError, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { useAppConfig } from '../../lib/config';
import { impersonationStore, setImpersonationRenewHandler, useImpersonation } from '../../lib/impersonation';
import { useRestaurant } from '../../lib/queries';
import { lastRestaurant } from '../../lib/storage';
import { ForbiddenPage } from '../../pages/ErrorPages';
import { HomePage } from '../../pages/HomePage';
import { ImpersonationBanner } from '../admin/ImpersonationBanner';
import { OrderingProvider } from '../orders/OrderingProvider';
import { ElevationProvider } from '../security/ElevationProvider';
import { Button } from '../ui/Button';
import { AppShell } from './AppShell';
import { FullPageLoading } from './RequireAuth';

export interface RestaurantContextValue {
  restaurant: RestaurantDto;
  role: MembershipRole;
  /** Owners (and superadmins acting as owners) may change settings, branding, publish and delete. */
  isOwner: boolean;
  isMobile: boolean;
  /**
   * Feature modules (Phase 9b): every ordering/payment/POS screen, card and action is gated on these. A module whose
   * global feature flag (Phase 10, GET /api/config) is off reads as off here even if the venue has it stored.
   */
  hasModule: (module: ModuleKey) => boolean;
  /** The deployment's global flags, for copy such as "Not available yet". */
  features: FeatureFlags;
  /** True while a superadmin is inside this venue through "Open as owner" (Phase 13). */
  impersonating: boolean;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function useRestaurantContext(): RestaurantContextValue {
  const value = useContext(RestaurantContext);
  if (!value) throw new Error('useRestaurantContext must be used under /r/:restaurantId');
  return value;
}

/**
 * Superadmins who are not members of the venue always enter it through "Open as owner" (Phase 13): the token is
 * requested here (and again when it expires), so a direct link to /r/:id works and every visit is audited.
 */
function useOwnerAccess(restaurantId: string, needed: boolean) {
  const active = useImpersonation();
  const ready = !needed || active?.restaurantId === restaurantId;
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!needed) return;
    setImpersonationRenewHandler((rid) => openAsOwner(rid).then(() => true).catch(() => false));
    return () => setImpersonationRenewHandler(null);
  }, [needed]);

  useEffect(() => {
    if (!needed || ready) return;
    let cancelled = false;
    impersonate(restaurantId)
      .then((dto) => {
        // Only while this venue is still on screen: leaving through the banner must not revive the session.
        if (!cancelled) impersonationStore.setFromDto(dto);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [needed, ready, restaurantId, attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };
  return { ready, error, retry, impersonation: ready && needed ? active : null };
}

/** /r/:restaurantId — verifies membership, loads the restaurant, remembers it as last used, renders the shell. */
export function RestaurantLayout() {
  const { restaurantId = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { features } = useAppConfig();
  const membership = me.memberships.find((m) => m.restaurant.id === restaurantId);
  const allowed = Boolean(membership) || me.user.isSuperadmin;
  const impersonating = !membership && me.user.isSuperadmin;
  const access = useOwnerAccess(restaurantId, impersonating);
  const query = useRestaurant(restaurantId, allowed && access.ready);

  useEffect(() => {
    // Only venues the person is a member of count as "last used"; an admin visit must not leak into "/".
    if (membership && query.data) lastRestaurant.set(me.user.id, restaurantId);
  }, [membership, query.data, restaurantId, me.user.id]);

  if (!allowed) return <ForbiddenPage />;
  if (impersonating && access.error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted">{errorMessage(access.error, 'Could not open this venue as its owner')}</p>
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/admin/restaurants/${restaurantId}`)}>Back to admin</Button>
            <Button variant="primary" onClick={access.retry}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (impersonating && !access.ready) return <FullPageLoading label="Opening as owner" />;
  if (query.isPending) return <FullPageLoading label="Loading venue" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 403 || query.error.status === 404)) {
      lastRestaurant.set(me.user.id, null);
      impersonationStore.clear();
      return <Navigate to={impersonating ? '/admin/restaurants' : '/'} replace />;
    }
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-muted">{errorMessage(query.error, 'Could not load this venue')}</p>
          <Button variant="primary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const role: MembershipRole = me.user.isSuperadmin ? 'owner' : membership!.role;
  return (
    <RestaurantContext.Provider
      value={{
        restaurant: query.data,
        role,
        isOwner: role === 'owner',
        isMobile,
        hasModule: (module) => moduleAvailable(features, module) && hasModule(query.data, module),
        features,
        impersonating,
      }}
    >
      {/* Owner PIN (Phase 11): this device's elevation, the keypad and the API client's retry hook. */}
      <ElevationProvider restaurant={query.data} isOwner={role === 'owner'}>
        {/* Live orders/calls (SSE + polling fallback) for the nav badge, the title and the waiter screen; idle when ordering is off. */}
        <OrderingProvider restaurant={query.data}>
          <div className="flex h-dvh flex-col">
            {access.impersonation ? <ImpersonationBanner impersonation={access.impersonation} /> : null}
            <div className="min-h-0 flex-1">
              <AppShell restaurant={query.data} role={role}>
                <Outlet />
              </AppShell>
            </div>
          </div>
        </OrderingProvider>
      </ElevationProvider>
    </RestaurantContext.Provider>
  );
}

/** Index of /r/:restaurantId: phones get the Home screen (M2), larger screens go straight to the menu editor. */
export function RestaurantIndex() {
  const isMobile = useIsMobile();
  return isMobile ? <HomePage /> : <Navigate to="menu" replace />;
}
