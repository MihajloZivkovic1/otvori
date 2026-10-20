import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SuperadminRestaurantDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { LogoTile } from '../components/LogoTile';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { RestaurantDrawer } from '../components/superadmin/RestaurantDrawer';
import { Button, IconButton } from '../components/ui/Button';
import { StatusDot, type StatusTone } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { useDebounced } from '../hooks/useDebounced';
import { useIsMobile } from '../hooks/useMediaQuery';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { daysLeft, editedAt } from '../lib/format';
import { useSuperadminRestaurants } from '../lib/queries';

const GRID = 'grid grid-cols-[minmax(200px,1.6fr)_1fr_1fr_1fr_1.2fr_40px] items-center gap-3';
const STATUS_TONE: Record<SuperadminRestaurantDto['status'], StatusTone> = { active: 'success', trial: 'warning', suspended: 'danger' };

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function planLabel(row: SuperadminRestaurantDto): string {
  if (row.plan === 'trial') {
    const left = daysLeft(row.trialEndsAt);
    if (left === null) return 'Trial';
    if (left === 0) return 'Trial · ended';
    return `Trial · ${left} ${left === 1 ? 'day' : 'days'} left`;
  }
  return capitalize(row.plan);
}

export function SuperadminPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), 300);
  const query = useSuperadminRestaurants({ search: debounced || undefined, pageSize: 100 });
  const [editing, setEditing] = useState<SuperadminRestaurantDto | null>(null);
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const searchBox = (
    <Input
      type="search"
      aria-label="Search restaurants"
      placeholder="Search by name or city"
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      controlSize={isMobile ? 'lg' : 'md'}
      className={isMobile ? '' : 'h-9 w-[260px] text-[13px]'}
    />
  );

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-6' : 'gap-4 p-6')}>
      {isMobile ? (
        <>
          <MobileHeader large title="All restaurants" action={null} />
          <div className="px-4">{searchBox}</div>
        </>
      ) : (
        <PageHeader title="All restaurants" subtitle={query.data ? `${total} ${total === 1 ? 'venue' : 'venues'} on this instance.` : 'Every venue on this instance.'} actions={searchBox} />
      )}

      <div className={cn('overflow-hidden border-line bg-surface', isMobile ? 'border-y' : 'rounded-[10px] border')}>
        {isMobile ? null : (
          <div className={cn(GRID, 'h-9 border-b border-line-2 px-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted')}>
            <span>Restaurant</span>
            <span>Status</span>
            <span>Plan</span>
            <span>Tables · items</span>
            <span>Last edited</span>
            <span />
          </div>
        )}
        {query.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading restaurants">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-14 items-center gap-3 border-b border-line-2 px-4">
                <Skeleton className="size-7 rounded-[7px]" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState variant="inline" icon="warning" title="Could not load restaurants" description={errorMessage(query.error)} actions={<Button size="sm" onClick={() => void query.refetch()}>Try again</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState variant="inline" title={debounced ? `No venues match “${debounced}”.` : 'No venues yet.'} />
        ) : (
          <ul aria-label="Restaurants" className={cn(query.isPlaceholderData && 'opacity-60')}>
            {rows.map((row) => {
              const open = () => navigate(`/r/${row.id}/menu`);
              const tile = <LogoTile name={row.name} color={row.primaryColor} logoUrl={row.logoUrl} size={28} radius={7} />;
              const manage = (
                <IconButton
                  label={`Manage ${row.name}`}
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(row);
                  }}
                >
                  <Icon name="pencil" size={14} />
                </IconButton>
              );
              if (isMobile) {
                return (
                  <li key={row.id} className="flex h-16 items-center gap-3 border-b border-line-2 px-4 last:border-b-0">
                    <button type="button" onClick={open} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left text-ink">
                      {tile}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-medium">{row.name}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <StatusDot tone={STATUS_TONE[row.status]} /> {capitalize(row.status)} · {planLabel(row)}
                          {row.city ? ` · ${row.city}` : ''}
                        </span>
                      </span>
                    </button>
                    {manage}
                  </li>
                );
              }
              return (
                <li
                  key={row.id}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.target === event.currentTarget) open();
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${row.name}`}
                  className={cn(GRID, 'h-14 cursor-pointer border-b border-line-2 px-4 last:border-b-0 hover:bg-canvas')}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {tile}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{row.name}</div>
                      <div className="truncate text-xs text-muted">{row.city ?? row.slug}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <StatusDot tone={STATUS_TONE[row.status]} />
                    {capitalize(row.status)}
                  </span>
                  <span className="text-[13px] text-ink-2">{planLabel(row)}</span>
                  <span className="text-[13px] tabular-nums text-ink-2">
                    {row.tableCount} · {row.itemCount}
                  </span>
                  <span className="text-[13px] text-muted">{editedAt(row.updatedAt)}</span>
                  <div className="flex justify-end">{manage}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing ? <RestaurantDrawer restaurant={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
