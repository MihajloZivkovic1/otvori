import { Navigate } from 'react-router';
import { useMe } from '../../lib/auth';
import { lastRestaurant } from '../../lib/storage';

/** "/" → the last used venue, else the first membership, else superadmin list / no-venue screen. */
export function HomeRedirect() {
  const me = useMe();
  const last = lastRestaurant.get(me.user.id);
  const isMember = (id: string) => me.memberships.some((m) => m.restaurant.id === id);
  const target = last && (isMember(last) || me.user.isSuperadmin) ? last : me.memberships[0]?.restaurant.id;
  if (target) return <Navigate to={`/r/${target}`} replace />;
  if (me.user.isSuperadmin) return <Navigate to="/superadmin" replace />;
  return <Navigate to="/no-venue" replace />;
}
