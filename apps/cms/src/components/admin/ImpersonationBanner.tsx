import { useNavigate } from 'react-router';
import { useMe } from '../../lib/auth';
import { impersonationStore, type Impersonation } from '../../lib/impersonation';
import { lastRestaurant } from '../../lib/storage';
import { Icon } from '../icons';

/**
 * Shown on every venue screen while a superadmin is inside a venue as its owner (Phase 13). The copy is in
 * Serbian on purpose — it is the one line a venue owner looking over the admin's shoulder should understand.
 */
export function ImpersonationBanner({ impersonation }: { impersonation: Impersonation }) {
  const navigate = useNavigate();
  const me = useMe();
  const leave = () => {
    impersonationStore.clear();
    lastRestaurant.set(me.user.id, null);
    navigate(`/admin/restaurants/${impersonation.restaurantId}`);
  };
  return (
    <div role="status" aria-label="Open as owner" className="flex min-h-9 shrink-0 items-center justify-center gap-3 bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent">
      <Icon name="shield" size={14} strokeWidth={2} className="shrink-0" />
      <span className="truncate">
        Prijavljen kao vlasnik lokala <strong>{impersonation.restaurantName}</strong>
      </span>
      <span aria-hidden="true" className="opacity-60">
        ·
      </span>
      <button type="button" onClick={leave} className="shrink-0 cursor-pointer whitespace-nowrap font-semibold underline underline-offset-2">
        Nazad u admin
      </button>
    </div>
  );
}
