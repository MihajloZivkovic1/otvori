import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { MenuItemDto } from '@qr-menu/shared';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { SwitchTrack } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { text } from '../lib/format';
import { useCategories, useItems, useSetAvailability } from '../lib/queries';

/**
 * "Unavailable today" (design M8): one switch per item. Turning an item off marks it unavailable until 06:00
 * tomorrow in the restaurant's time zone; turning it on clears any unavailability.
 */
export function UnavailablePage() {
  const { restaurant, isMobile } = useRestaurantContext();
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useCategories(restaurant.id);
  const items = useItems(restaurant.id);
  const setAvailability = useSetAvailability(restaurant.id);
  const [turningAllOn, setTurningAllOn] = useState(false);
  const home = `/r/${restaurant.id}`;

  const all = items.data ?? [];
  const off = all.filter((item) => !item.isEffectivelyAvailable);
  const groups = (categories.data ?? [])
    .filter((category) => !category.isHidden)
    .map((category) => ({ category, items: all.filter((item) => item.categoryId === category.id) }))
    .filter((group) => group.items.length > 0);

  const toggle = (item: MenuItemDto) =>
    setAvailability.mutate(
      { id: item.id, input: item.isEffectivelyAvailable ? { available: false, until: 'tomorrow-06:00' } : { available: true } },
      { onError: (error) => toast.error(errorMessage(error)) },
    );

  const turnAllOn = async () => {
    setTurningAllOn(true);
    try {
      await Promise.all(off.map((item) => setAvailability.mutateAsync({ id: item.id, input: { available: true } })));
      toast.success('Everything is back on the menu');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTurningAllOn(false);
    }
  };

  const loading = categories.isPending || items.isPending;

  return (
    <div className="flex flex-1 flex-col">
      {isMobile ? (
        <MobileHeader
          title="Unavailable today"
          backTo={home}
          action={
            <Button variant="accent-text" className="h-11 px-2" onClick={() => navigate(home)}>
              Done
            </Button>
          }
        />
      ) : (
        <div className="px-6 pt-6">
          <PageHeader title="Unavailable today" subtitle="Switch items off for the rest of the day. They come back automatically at 06:00." />
        </div>
      )}
      <div className={cn('mx-auto flex w-full flex-col', !isMobile && 'max-w-[640px] px-6')}>
        <div className="mx-4 mb-2 mt-1 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 tab:mx-0 tab:mt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{loading ? <Skeleton className="h-4 w-20" /> : `${off.length} off today`}</span>
            <span className="text-xs text-muted">Everything comes back at 06:00.</span>
          </div>
          <Button onClick={() => void turnAllOn()} disabled={off.length === 0} loading={turningAllOn} className="shrink-0">
            Turn all on
          </Button>
        </div>
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading items" className="flex flex-col gap-px pt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-14 items-center gap-3 bg-surface px-4">
                <Skeleton className="h-3.5 w-[45%]" />
                <Skeleton className="ml-auto h-7 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState variant="inline" title="No items to switch off yet." />
        ) : (
          groups.map(({ category, items: groupItems }) => (
            <section key={category.id} aria-labelledby={`group-${category.id}`}>
              <h2 id={`group-${category.id}`} className="px-4 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted tab:px-0">
                {text(category.name, restaurant.defaultLocale)}
              </h2>
              <div className="border-y border-line-2 bg-surface tab:rounded-[10px] tab:border tab:border-line">
                {groupItems.map((item) => {
                  const available = item.isEffectivelyAvailable;
                  const name = text(item.name, restaurant.defaultLocale) || 'Untitled item';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="switch"
                      aria-checked={available}
                      aria-label={name}
                      onClick={() => toggle(item)}
                      className="flex h-14 w-full cursor-pointer items-center gap-3 border-b border-line-2 px-4 text-left text-ink last:border-b-0"
                    >
                      <span className={cn('flex-1 truncate text-base font-medium', !available && 'opacity-50')}>{name}</span>
                      {!available ? <span className="text-xs text-muted">Off today</span> : null}
                      <SwitchTrack checked={available} size="lg" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
