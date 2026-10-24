import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useSecurity, useUpdateSecurity } from '../../lib/queries';
import { Icon } from '../icons';
import { PinSetupModal } from '../security/PinSetupModal';
import { useElevation } from '../security/ElevationProvider';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';

/**
 * Settings → "Protection" (owner): the owner PIN for the shared bar device, the daily digest mail and the link to
 * the change history. Recommends PIN for the shared device and personal staff accounts for waiters' phones.
 */
export function SecurityCard() {
  const { restaurant, isMobile } = useRestaurantContext();
  const { locked, lock, ensureElevated } = useElevation();
  const toast = useToast();
  const security = useSecurity(restaurant.id);
  const update = useUpdateSecurity(restaurant.id);
  const [modal, setModal] = useState<'set' | 'change' | 'remove' | null>(null);
  const pinSet = security.data?.pinSet ?? restaurant.pinSet;

  return (
    <section aria-labelledby="security-title" className={cn('flex flex-col bg-surface', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}>
      <div className="flex flex-col gap-1 border-b border-line-2 px-5 pb-4 pt-5">
        <h2 id="security-title" className="text-base font-semibold">
          Protection
        </h2>
        <p className="text-[13px] text-pretty text-muted">
          Most venues run the CMS on one shared phone or tablet at the bar. The owner PIN keeps prices, menu content, branding, settings and the team
          behind four digits there; orders, calls and “unavailable today” never ask for it. For waiters’ own phones, give them staff accounts below instead.
        </p>
      </div>

      <div className="flex items-center gap-3.5 px-5 py-4">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', pinSet ? 'bg-accent-soft text-accent' : 'bg-line-2 text-muted')}>
          <Icon name="lock" size={18} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Owner PIN</div>
          <div className="text-[13px] text-muted">
            {security.isPending ? <Skeleton className="h-3 w-40" /> : pinSet ? (locked ? 'Set · this device is locked' : 'Set · this device is unlocked') : 'Not set — every owner session can change everything'}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {pinSet ? (
            <>
              {locked ? (
                <Button size="sm" onClick={() => void ensureElevated()}>
                  Unlock
                </Button>
              ) : (
                <Button size="sm" onClick={lock}>
                  Lock now
                </Button>
              )}
              <Button size="sm" onClick={() => setModal('change')}>
                Change
              </Button>
              <Button size="sm" variant="danger-ghost" onClick={() => setModal('remove')}>
                Remove
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setModal('set')}>
              Set PIN
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3.5 border-t border-line-2 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Daily summary by e-mail</div>
          <div className="text-[13px] text-pretty text-muted">Every morning at 07:00: “Juče: 3 promene cena, 1 novi artikal, 2 pogrešna PIN-a” with a link to the history. Nothing is sent on quiet days.</div>
        </div>
        <Switch
          checked={security.data?.dailyDigest ?? false}
          disabled={security.isPending}
          label="Daily summary by e-mail"
          onChange={(checked) => update.mutate({ dailyDigest: checked }, { onError: (error) => toast.error(errorMessage(error)) })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3.5">
        <div className="text-[13px] text-muted">Who changed what and when — prices, availability, orders, sign-ins and PIN attempts for the last 90 days.</div>
        <Link to={`/r/${restaurant.id}/settings/history`} className="shrink-0 text-sm font-medium text-accent no-underline">
          Change history
        </Link>
      </div>
      {modal ? <PinSetupModal mode={modal} onClose={() => setModal(null)} /> : null}
    </section>
  );
}
