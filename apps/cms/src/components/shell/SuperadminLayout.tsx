import { Navigate, Outlet } from 'react-router';
import { useMe } from '../../lib/auth';
import { useRestaurant } from '../../lib/queries';
import { lastRestaurant } from '../../lib/storage';
import { AppShell } from './AppShell';

/** /superadmin — the shell keeps the last used venue in the switcher so the nav still leads somewhere. */
export function SuperadminLayout() {
  const me = useMe();
  const last = lastRestaurant.get(me.user.id);
  const contextId = last ?? me.memberships[0]?.restaurant.id ?? null;
  const query = useRestaurant(contextId ?? '', Boolean(contextId));
  if (!me.user.isSuperadmin) return <Navigate to="/" replace />;
  return (
    <AppShell restaurant={query.data ?? null} role="owner" title="All restaurants">
      <Outlet />
    </AppShell>
  );
}
