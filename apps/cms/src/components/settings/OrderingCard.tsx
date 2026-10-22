import { useState } from 'react';
import { ORDERING_LIMITS, ORDERING_MODES, type OrderingMode } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useUpdateRestaurant } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';

const MODES: Record<OrderingMode, { label: string; description: string }> = {
  off: { label: 'Off', description: 'The menu is view-only.' },
  call_waiter: { label: 'Call the waiter only', description: '“Call the waiter” and “The bill” buttons, no cart.' },
  order: { label: 'Ordering', description: 'Guests pick items and send the order to the waiter. Calling the waiter is included.' },
};

/** Settings → "Ordering" (design B5, owner only): mode, pause switch and the message guests see while paused. */
export function OrderingCard() {
  const { restaurant, isMobile } = useRestaurantContext();
  const toast = useToast();
  const update = useUpdateRestaurant(restaurant.id);
  const [mode, setMode] = useState<OrderingMode>(restaurant.orderingMode);
  const [paused, setPaused] = useState(restaurant.orderingPaused);
  const [message, setMessage] = useState(restaurant.pausedMessage ?? '');
  const dirty =
    mode !== restaurant.orderingMode || paused !== restaurant.orderingPaused || message.trim() !== (restaurant.pausedMessage ?? '');

  const save = () =>
    update.mutate(
      { orderingMode: mode, orderingPaused: paused, pausedMessage: message.trim() || null },
      {
        onSuccess: () => toast.success('Ordering settings saved'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <section aria-labelledby="ordering-title" className={cn('flex flex-col bg-surface', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}>
      <div className="flex flex-col gap-1 border-b border-line-2 px-5 pb-4 pt-5">
        <h2 id="ordering-title" className="text-base font-semibold">
          Ordering
        </h2>
        <p className="text-[13px] text-pretty text-muted">
          Guests can call the waiter or send an order from their phone. No payment — the guest pays the waiter as before.
        </p>
      </div>
      <div role="radiogroup" aria-label="Ordering mode" className="flex flex-col gap-2 px-5 py-4">
        {ORDERING_MODES.map((candidate) => {
          const selected = candidate === mode;
          return (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(candidate)}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3 text-left text-ink',
                selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
              )}
            >
              <span className={cn('mt-px grid size-[18px] shrink-0 place-items-center rounded-full border-2', selected ? 'border-accent' : 'border-faint')} aria-hidden="true">
                <span className={cn('size-2 rounded-full', selected && 'bg-accent')} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{MODES[candidate].label}</span>
                <span className="text-[13px] text-muted">{MODES[candidate].description}</span>
              </span>
              {candidate === 'off' ? (
                <span className="shrink-0 rounded-sm bg-line-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-[.04em] text-muted">DEFAULT</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3.5 px-5 pb-4">
        <div className="flex items-center gap-3.5 rounded-[10px] border border-line p-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Pause ordering</div>
            <div className="text-[13px] text-pretty text-muted">Guests see a message; “+” and the cart are hidden. Calls still work. Open orders stay.</div>
          </div>
          <Switch checked={paused} onChange={setPaused} label="Pause ordering" />
        </div>
        <label htmlFor="paused-message" className={cn('flex flex-col gap-1.5 transition-opacity', !paused && 'opacity-55')}>
          <span className="flex justify-between">
            <span className="text-[13px] font-medium">Message to guests while paused</span>
            <span className="text-xs text-faint tabular-nums">
              {message.length}/{ORDERING_LIMITS.pausedMessageMax}
            </span>
          </span>
          <Input
            id="paused-message"
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, ORDERING_LIMITS.pausedMessageMax))}
            maxLength={ORDERING_LIMITS.pausedMessageMax}
            controlSize={isMobile ? 'lg' : 'md'}
            placeholder="Ordering is paused right now. Your waiter is happy to help."
          />
        </label>
      </div>
      <div className="flex items-center gap-3 border-t border-line-2 px-5 py-3.5">
        <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty}>
          Save
        </Button>
        <span className="text-xs text-muted">Changes reach every table within a minute (guests' menus refresh every 30 s). Only the owner can change these settings.</span>
      </div>
    </section>
  );
}
