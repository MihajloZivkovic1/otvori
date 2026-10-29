import { Navigate } from 'react-router';
import { useMe } from '../../lib/auth';
import { lastRestaurant } from '../../lib/storage';

/**
 * "/" → the last used venue (only one the person is a real member of), else the first membership, else the
 * superadmin area / the no-venue screen. A superadmin's "Open as owner" visits never count as the last venue.
 */
export function HomeRedirect() {
  const me = useMe();
  const last = lastRestaurant.get(me.user.id);
  const isMember = (id: string) => me.memberships.some((m) => m.restaurant.id === id);
  const target = last && isMember(last) ? last : me.memberships[0]?.restaurant.id;
  if (target) return <Navigate to={`/r/${target}`} replace />;
  if (me.user.isSuperadmin) return <Navigate to="/admin/restaurants" replace />;
  return <Navigate to="/no-venue" replace />;
}
