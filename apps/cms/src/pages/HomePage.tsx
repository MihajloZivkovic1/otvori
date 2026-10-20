import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/icons';
import { LogoTile } from '../components/LogoTile';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { VenueSheet } from '../components/shell/VenueSheet';
import { StatusPill } from '../components/ui/Chip';
import { Skeleton } from '../components/ui/Skeleton';
import { plural, text } from '../lib/format';
import { useAnalytics, useCategories, useItems, useTables } from '../lib/queries';

/** Mobile home (design M2): venue card, four quick actions, today's numbers. */
export function HomePage() {
  const { restaurant } = useRestaurantContext();
  const rid = restaurant.id;
  const categories = useCategories(rid);
  const items = useItems(rid);
  const tables = useTables(rid);
  const analytics = useAnalytics(rid, '7d');
  const [switching, setSwitching] = useState(false);

  const allItems = items.data ?? [];
  const offToday = allItems.filter((item) => !item.isEffectivelyAvailable).length;
  const today = analytics.data?.scansPerDay.at(-1)?.scans;
  const busiest = analytics.data ? [...analytics.data.scansByTable].sort((a, b) => b.scans - a.scans)[0] : undefined;
  const topItem = analytics.data?.topItems[0];

  const card = 'flex h-[132px] flex-col items-start justify-between rounded-[14px] p-4 text-left no-underline';

  return (
    <div className="flex flex-1 flex-col">
      <div className="safe-top flex items-center justify-between gap-3 px-5 pb-3">
        <button
          type="button"
          onClick={() => setSwitching(true)}
          aria-haspopup="dialog"
          className="flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface pl-1.5 pr-3 text-left text-ink"
        >
          <LogoTile name={restaurant.name} color={restaurant.primaryColor} logoUrl={restaurant.logoUrl} size={36} radius={9} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold leading-tight">{restaurant.name}</span>
            <span className="text-xs text-muted">Switch venue</span>
          </span>
          <Icon name="chevronsUpDown" size={14} className="shrink-0 text-muted" />
        </button>
        {restaurant.status === 'suspended' ? (
          <StatusPill tone="danger">Suspended</StatusPill>
        ) : restaurant.publishedAt ? (
          <StatusPill tone="success">Live</StatusPill>
        ) : (
          <StatusPill tone="warning">Unpublished</StatusPill>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <Link to={`/r/${rid}/menu`} className={`${card} bg-accent text-on-accent`}>
            <Icon name="pencil" size={22} />
            <span>
              <span className="block text-base font-semibold">Edit menu</span>
              <span className="mt-0.5 block text-xs opacity-85">
                {items.data && categories.data ? `${plural(allItems.length, 'item', 'items')} · ${plural(categories.data.length, 'category', 'categories')}` : '…'}
              </span>
            </span>
          </Link>
          <Link to={`/r/${rid}/menu/unavailable`} className={`${card} border border-line bg-surface text-ink`}>
            <Icon name="unavailable" size={22} />
            <span>
              <span className="block text-base font-semibold">Mark unavailable</span>
              <span className="mt-0.5 block text-xs text-muted">{items.data ? `${offToday} off today` : '…'}</span>
            </span>
          </Link>
          <Link to={`/r/${rid}/tables`} className={`${card} border border-line bg-surface text-ink`}>
            <Icon name="tables" size={22} />
            <span>
              <span className="block text-base font-semibold">Tables &amp; QR</span>
              <span className="mt-0.5 block text-xs text-muted">{tables.data ? plural(tables.data.length, 'table', 'tables') : '…'}</span>
            </span>
          </Link>
          <a href={restaurant.publicUrl} target="_blank" rel="noreferrer" className={`${card} border border-line bg-surface text-ink`}>
            <Icon name="externalBox" size={22} />
            <span>
              <span className="block text-base font-semibold">View live menu</span>
              <span className="mt-0.5 block text-xs text-muted">As guests see it</span>
            </span>
          </a>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">Scans today</span>
            {analytics.isPending ? <Skeleton className="h-6 w-10" /> : <span className="text-[22px] font-semibold leading-[1.1] tabular-nums">{today ?? 0}</span>}
          </div>
          <div className="flex flex-col gap-0.5 border-l border-line pl-3">
            <span className="text-xs text-muted">Busiest table</span>
            {analytics.isPending ? (
              <Skeleton className="h-6 w-8" />
            ) : (
              <span className="text-[22px] font-semibold leading-[1.1]">{busiest && busiest.scans > 0 ? (busiest.number ?? busiest.label) : '—'}</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5 border-l border-line pl-3">
            <span className="text-xs text-muted">Top item</span>
            {analytics.isPending ? (
              <Skeleton className="mt-1 h-4 w-16" />
            ) : (
              <span className="mt-1 truncate text-[15px] font-semibold leading-[1.2]">{topItem ? text(topItem.name, restaurant.defaultLocale) : '—'}</span>
            )}
          </div>
        </div>
      </div>
      <VenueSheet open={switching} onClose={() => setSwitching(false)} currentId={rid} />
    </div>
  );
}
