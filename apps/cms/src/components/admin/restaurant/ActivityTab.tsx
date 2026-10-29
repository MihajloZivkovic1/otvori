import { useMemo, useState } from 'react';
import { AUDIT_KINDS, type AuditKind, type SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminActivity } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { AuditEntries, KIND_LABELS } from '../../audit/AuditEntries';
import { Pagination } from '../../ui/DataTable';
import { Input, Select } from '../../ui/Field';

const PAGE_SIZE = 50;

/** The venue's own audit log, read through the superadmin activity endpoint (no impersonation needed). */
export function ActivityTab({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const isMobile = useIsMobile();
  const [kind, setKind] = useState<AuditKind>('all');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => ({
      restaurantId: venue.id,
      kind,
      ...(userId ? { userId } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [venue.id, kind, userId, from, to, page],
  );
  const log = useAdminActivity(query);
  const reset = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const members = new Set(venue.members.map((m) => m.userId));
  const who = (log.data?.users ?? []).filter((u) => members.has(u.id) || log.data?.items.some((e) => e.user?.id === u.id));

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Kind" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {AUDIT_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={kind === option}
            onClick={() => reset(setKind)(option)}
            className={cn('h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-[13px] font-medium', kind === option ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink')}
          >
            {KIND_LABELS[option]}
          </button>
        ))}
      </div>
      <div className={cn('flex gap-2', isMobile && 'flex-col')}>
        <Select aria-label="Who" value={userId} onChange={(e) => reset(setUserId)(e.target.value)} className={isMobile ? '' : 'w-48'}>
          <option value="">Everyone</option>
          {who.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || 'Unknown'}
            </option>
          ))}
        </Select>
        <Input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} className={isMobile ? '' : 'w-40'} />
        <Input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} className={isMobile ? '' : 'w-40'} />
      </div>
      <AuditEntries
        entries={log.data?.items ?? []}
        loading={log.isPending}
        error={log.isError ? log.error : undefined}
        errorMessage={log.isError ? errorMessage(log.error) : undefined}
        onRetry={() => void log.refetch()}
        currency={venue.currency}
        isMobile={isMobile}
        emptyDescription="Changes, sign-ins and order actions of this venue show up here."
        className={isMobile ? '-mx-4' : ''}
      />
      {log.data && log.data.total > PAGE_SIZE ? <Pagination page={page} pageSize={PAGE_SIZE} total={log.data.total} onPage={setPage} /> : null}
    </div>
  );
}
