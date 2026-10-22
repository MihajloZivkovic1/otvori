import { createContext, useContext, useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
import { hasModule, type MembershipRole, type ModuleKey, type RestaurantDto } from '@qr-menu/shared';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { ApiError, errorMessage } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { useRestaurant } from '../../lib/queries';
import { lastRestaurant } from '../../lib/storage';
import { HomePage } from '../../pages/HomePage';
import { OrderingProvider } from '../orders/OrderingProvider';
import { Button } from '../ui/Button';
import { AppShell } from './AppShell';
import { FullPageLoading } from './RequireAuth';

export interface RestaurantContextValue {
  restaurant: RestaurantDto;
  role: MembershipRole;
  /** Owners (and superadmins acting as owners) may change settings, branding, publish and delete. */
  isOwner: boolean;
  isMobile: boolean;
  /** Feature modules (Phase 9b): every ordering/payment/POS screen, card and action is gated on these. */
  hasModule: (module: ModuleKey) => boolean;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function useRestaurantContext(): RestaurantContextValue {
  const value = useContext(RestaurantContext);
  if (!value) throw new Error('useRestaurantContext must be used under /r/:restaurantId');
  return value;
}

/** /r/:restaurantId — verifies membership, loads the restaurant, remembers it as last used, renders the shell. */
export function RestaurantLayout() {
  const { restaurantId = '' } = useParams();
  const me = useMe();
  const isMobile = useIsMobile();
  const membership = me.memberships.find((m) => m.restaurant.id === restaurantId);
  const allowed = Boolean(membership) || me.user.isSuperadmin;
  const query = useRestaurant(restaurantId, allowed);

  useEffect(() => {
    if (allowed && query.data) lastRestaurant.set(me.user.id, restaurantId);
  }, [allowed, query.data, restaurantId, me.user.id]);

  if (!allowed) return <Navigate to="/" replace />;
  if (query.isPending) return <FullPageLoading label="Loading venue" />;
  if (query.isError) {
    if (query.error instanceof ApiError && (query.error.status === 403 || query.error.status === 404)) {
      lastRestaurant.set(me.user.id, null);
      return <Navigate to="/" replace />;
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
      value={{ restaurant: query.data, role, isOwner: role === 'owner', isMobile, hasModule: (module) => hasModule(query.data, module) }}
    >
      {/* Live orders/calls (SSE + polling fallback) for the nav badge, the title and the waiter screen; idle when ordering is off. */}
      <OrderingProvider restaurant={query.data}>
        <AppShell restaurant={query.data} role={role}>
          <Outlet />
        </AppShell>
      </OrderingProvider>
    </RestaurantContext.Provider>
  );
}

/** Index of /r/:restaurantId: phones get the Home screen (M2), larger screens go straight to the menu editor. */
export function RestaurantIndex() {
  const isMobile = useIsMobile();
  return isMobile ? <HomePage /> : <Navigate to="menu" replace />;
}
