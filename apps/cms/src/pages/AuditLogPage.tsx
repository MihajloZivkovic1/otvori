import { useMemo, useState } from 'react';
import { AUDIT_KINDS, type AuditKind } from '@qr-menu/shared';
import { AuditEntries, KIND_LABELS } from '../components/audit/AuditEntries';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Field';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { useAuditLog } from '../lib/queries';

/** Settings → "Change history" (owner): who changed what and when, price changes highlighted; 90-day retention. */
export function AuditLogPage() {
  const { restaurant, isMobile, isOwner } = useRestaurantContext();
  const [kind, setKind] = useState<AuditKind>('all');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => ({
      kind,
      ...(userId ? { userId } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
      page,
      pageSize: 50,
    }),
    [kind, userId, from, to, page],
  );
  const log = useAuditLog(restaurant.id, query, isOwner);
  const items = log.data?.items ?? [];
  const total = log.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  const reset = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const filters = (
    <div className={cn('flex flex-col gap-3', isMobile ? 'px-4' : '')}>
      <div role="tablist" aria-label="Kind" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {AUDIT_KINDS.filter((option) => option !== 'admin').map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={kind === option}
            onClick={() => reset(setKind)(option)}
            className={cn(
              'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-[13px] font-medium',
              kind === option ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink',
            )}
          >
            {KIND_LABELS[option]}
          </button>
        ))}
      </div>
      <div className={cn('flex gap-2', isMobile && 'flex-col')}>
        <Select aria-label="Who" value={userId} onChange={(e) => reset(setUserId)(e.target.value)} className={isMobile ? '' : 'w-48'}>
          <option value="">Everyone</option>
          {(log.data?.users ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || 'Unknown'}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} className={isMobile ? '' : 'w-40'} />
        <Input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} className={isMobile ? '' : 'w-40'} />
      </div>
    </div>
  );

  if (!isOwner) {
    return (
      <div className="flex flex-1 flex-col">
        {isMobile ? <MobileHeader title="Change history" backTo={`/r/${restaurant.id}/settings`} /> : <div className="px-6 pt-6"><PageHeader title="Change history" /></div>}
        <EmptyState variant="inline" title="Only owners can see the change history." />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-8' : 'max-w-[760px] gap-5 p-6')}>
      {isMobile ? <MobileHeader title="Change history" backTo={`/r/${restaurant.id}/settings`} /> : <PageHeader title="Change history" subtitle="Who changed what and when. Kept for 90 days." />}
      {filters}
      <AuditEntries
        entries={items}
        loading={log.isPending}
        error={log.isError ? log.error : undefined}
        errorMessage={log.isError ? errorMessage(log.error) : undefined}
        onRetry={() => void log.refetch()}
        currency={restaurant.currency}
        isMobile={isMobile}
        emptyDescription="Changes, sign-ins and order actions will show up as they happen."
      />
      {pages > 1 ? (
        <div className={cn('flex items-center justify-between text-[13px] text-muted', isMobile && 'px-4')}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span>
            Page {page} of {pages} · {total} entries
          </span>
          <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      ) : null}
    </div>
  );
}
