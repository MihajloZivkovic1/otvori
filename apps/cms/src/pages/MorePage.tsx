import { useState } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../components/icons';
import { LogoTile } from '../components/LogoTile';
import { MobileHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { VenueSheet } from '../components/shell/VenueSheet';
import { Button } from '../components/ui/Button';
import { useAuth, useMe } from '../lib/auth';

const ROW = 'flex h-14 w-full items-center gap-3 border-b border-line-2 px-4 text-left text-base font-medium text-ink no-underline last:border-b-0';

/** Design M11. */
export function MorePage() {
  const { restaurant, role } = useRestaurantContext();
  const me = useMe();
  const { signOut } = useAuth();
  const [switching, setSwitching] = useState(false);
  const venues = me.memberships.length;

  const row = (icon: IconName, label: string, to: string) => (
    <Link to={to} className={ROW}>
      <Icon name={icon} size={20} className="text-muted" />
      <span className="flex-1">{label}</span>
      <Icon name="chevronRight" size={16} strokeWidth={1.8} className="text-muted" />
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader large title="More" />
      <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3.5">
          <LogoTile name={restaurant.name} color={restaurant.primaryColor} logoUrl={restaurant.logoUrl} size={44} radius={11} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-semibold">{restaurant.name}</span>
            <span className="text-xs text-muted">
              {me.user.isSuperadmin ? 'Superadmin' : role === 'owner' ? 'Owner' : 'Staff'}
              {venues > 0 ? ` · ${venues} ${venues === 1 ? 'venue' : 'venues'}` : ''}
            </span>
          </span>
          <Button onClick={() => setSwitching(true)} className="shrink-0">
            Switch
          </Button>
        </div>

        <nav className="overflow-hidden rounded-[14px] border border-line bg-surface" aria-label="More">
          {row('branding', 'Branding', `/r/${restaurant.id}/branding`)}
          {row('settings', 'Settings', `/r/${restaurant.id}/settings`)}
          <button type="button" onClick={() => setSwitching(true)} className={`${ROW} cursor-pointer bg-transparent`}>
            <Icon name="venues" size={20} className="text-muted" />
            <span className="flex-1">Switch venue</span>
            <Icon name="chevronRight" size={16} strokeWidth={1.8} className="text-muted" />
          </button>
          {me.user.isSuperadmin ? row('tables', 'All restaurants', '/superadmin') : null}
          <a href={restaurant.publicUrl} target="_blank" rel="noreferrer" className={ROW}>
            <Icon name="externalBox" size={20} className="text-muted" />
            <span className="flex-1">View live menu</span>
          </a>
        </nav>

        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          <button type="button" onClick={() => void signOut()} className={`${ROW} cursor-pointer bg-transparent text-danger-text`}>
            <Icon name="signOut" size={20} />
            Log out
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          salveta {__APP_VERSION__} · Signed in as {me.user.email}
        </p>
      </div>
      <VenueSheet open={switching} onClose={() => setSwitching(false)} currentId={restaurant.id} />
    </div>
  );
}
