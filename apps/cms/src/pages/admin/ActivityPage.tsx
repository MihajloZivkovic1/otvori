import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AUDIT_KINDS, type AuditKind } from '@qr-menu/shared';
import { AuditEntries, KIND_LABELS } from '../../components/audit/AuditEntries';
import { MobileHeader, PageHeader } from '../../components/shell/PageHeader';
import { Pagination } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAdminActivity } from '../../lib/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 50;

/** /admin/activity — the global audit log: every venue plus platform-level rows, filterable by venue, person and kind. */
export function ActivityPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind = ((AUDIT_KINDS as readonly string[]).includes(params.get('kind') ?? '') ? params.get('kind') : 'all') as AuditKind;
  const restaurantId = params.get('venue') ?? '';
  const userId = params.get('user') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const set = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const query = useMemo(
    () => ({
      kind,
      ...(restaurantId ? { restaurantId } : {}),
      ...(userId ? { userId } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [kind, restaurantId, userId, from, to, page],
  );
  const log = useAdminActivity(query);
  const total = log.data?.total ?? 0;

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-8' : 'max-w-[900px] gap-5 p-6')}>
      {isMobile ? <MobileHeader large title="Activity" /> : <PageHeader title="Activity" subtitle="Who changed what, across every venue. Kept for 90 days." />}
      <div className={cn('flex flex-col gap-3', isMobile && 'px-4')}>
        <div role="tablist" aria-label="Kind" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {AUDIT_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={kind === option}
              onClick={() => set({ kind: option === 'all' ? null : option })}
              className={cn('h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-[13px] font-medium', kind === option ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink')}
            >
              {KIND_LABELS[option]}
            </button>
          ))}
        </div>
        <div className={cn('flex gap-2', isMobile && 'flex-col')}>
          <Select aria-label="Venue" value={restaurantId} onChange={(e) => set({ venue: e.target.value })} className={isMobile ? '' : 'w-56'}>
            <option value="">Every venue</option>
            {(log.data?.restaurants ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Who" value={userId} onChange={(e) => set({ user: e.target.value })} className={isMobile ? '' : 'w-48'}>
            <option value="">Everyone</option>
            {(log.data?.users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || 'Unknown'}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value })} className={isMobile ? '' : 'w-40'} />
          <Input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value })} className={isMobile ? '' : 'w-40'} />
        </div>
      </div>
      <AuditEntries
        entries={log.data?.items ?? []}
        loading={log.isPending}
        error={log.isError ? log.error : undefined}
        errorMessage={log.isError ? errorMessage(log.error) : undefined}
        onRetry={() => void log.refetch()}
        showVenue
        onVenueClick={(id) => navigate(`/admin/restaurants/${id}/activity`)}
        isMobile={isMobile}
        emptyDescription="Venue changes, sign-ins, impersonations and account actions show up here."
      />
      {total > PAGE_SIZE ? <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={(next) => set({ page: String(next) }, false)} className={isMobile ? 'px-4' : ''} /> : null}
    </div>
  );
}
