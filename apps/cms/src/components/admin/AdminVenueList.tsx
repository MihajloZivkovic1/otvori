import { useState } from 'react';
import { RESTAURANT_STATUSES, type RestaurantStatus, type SuperadminRestaurantDto } from '@qr-menu/shared';
import { useDebounced } from '../../hooks/useDebounced';
import { useAdminRestaurants } from '../../lib/admin';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { LogoTile } from '../LogoTile';
import { Input } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';
import { capitalize } from './bits';

interface AdminVenueListProps {
  currentId: string | null;
  onPick: (restaurantId: string) => void;
  /** Rows that are the superadmin's own memberships are listed by the caller; skip them here. */
  excludeIds?: string[];
  large?: boolean;
}

/**
 * The superadmin's venue switcher (Phase 13): every venue, grouped by status, with a search box. Picking one
 * enters it through "Open as owner", so the impersonation banner always shows.
 */
export function AdminVenueList({ currentId, onPick, excludeIds = [], large = false }: AdminVenueListProps) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), 250);
  const query = useAdminRestaurants({ search: debounced || undefined, sort: 'name', dir: 'asc', pageSize: 100 });
  const rows = (query.data?.items ?? []).filter((row) => !excludeIds.includes(row.id));
  const groups = RESTAURANT_STATUSES.map((status) => ({ status, rows: rows.filter((row) => row.status === status) })).filter((group) => group.rows.length > 0);

  const row = (venue: SuperadminRestaurantDto) => (
    <button
      key={venue.id}
      type="button"
      role="menuitem"
      onClick={() => onPick(venue.id)}
      className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-ink hover:bg-line-2', large ? 'h-12' : venue.city ? 'h-11' : 'h-9', venue.id === currentId && 'bg-line-2')}
    >
      <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={large ? 28 : 20} radius={large ? 7 : 5} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate font-medium leading-tight', large ? 'text-[15px]' : 'text-[13px]')}>{venue.name}</span>
        {venue.city ? <span className="truncate text-[11px] leading-tight text-muted">{venue.city}</span> : null}
      </span>
      <Icon name="shield" size={12} className="shrink-0 text-faint" aria-label="Opens as owner" />
    </button>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 pt-1">
        <Input
          type="search"
          aria-label="Search all venues"
          placeholder="Search all venues"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={cn('text-[13px]', large ? 'h-11' : 'h-8')}
          data-autofocus
        />
      </div>
      <div className={cn('no-scrollbar flex flex-col gap-0.5 overflow-y-auto', large ? 'max-h-[50dvh]' : 'max-h-[44dvh]')} aria-live="polite">
        {query.isPending ? (
          <div role="status" aria-label="Loading venues" className="flex flex-col gap-1.5 px-2.5 py-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-2.5 py-2 text-xs text-muted">{debounced ? `No venues match “${debounced}”.` : 'No venues yet.'}</div>
        ) : (
          groups.map((group) => (
            <div key={group.status} role="group" aria-label={capitalize(group.status)}>
              <div className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                {capitalize(group.status)} <span className="font-normal">· {group.rows.length}</span>
              </div>
              {group.rows.map(row)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export type { RestaurantStatus };
