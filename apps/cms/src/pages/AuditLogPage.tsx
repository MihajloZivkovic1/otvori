import { useMemo, useState } from 'react';
import { AUDIT_KINDS, type AuditEntryDto, type AuditKind } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { clock, formatPrice } from '../lib/format';
import { useAuditLog } from '../lib/queries';

const KIND_LABELS: Record<AuditKind, string> = {
  all: 'All',
  prices: 'Prices',
  menu: 'Menu',
  availability: 'Availability',
  orders: 'Orders & calls',
  auth: 'Sign-ins & PIN',
  team: 'Team',
  settings: 'Settings',
};

const ACTION_TEXT: Record<string, string> = {
  'restaurant.update': 'changed venue settings',
  'restaurant.logo': 'uploaded a new logo',
  'restaurant.publish': 'published the menu',
  'restaurant.delete': 'deleted the venue',
  'category.create': 'added category',
  'category.update': 'changed category',
  'category.delete': 'deleted category',
  'category.reorder': 'reordered categories',
  'item.create': 'added item',
  'item.update': 'edited item',
  'item.delete': 'deleted item',
  'item.reorder': 'reordered items',
  'item.image': 'changed the photo of',
  'item.availability': 'changed availability of',
  'table.create': 'added',
  'table.update': 'changed',
  'table.delete': 'deleted',
  'table.reorder': 'reordered tables',
  'table.block': 'blocked ordering from',
  'table.unblock': 'unblocked',
  'payment_config.update': 'changed the payment set-up',
  'pos_config.update': 'changed the POS set-up',
  'pos.sync': 'synced products from the register',
  'order.accept': 'accepted order',
  'order.reject': 'rejected order',
  'order.deliver': 'delivered order',
  'order.cash': 'marked as paid in cash',
  'order.fiscal_retry': 'retried the fiscal receipt for',
  'order.fiscal_manual': 'issued the receipt at the register for',
  'request.done': 'answered a call from',
  'auth.login': 'signed in',
  'auth.pin_set': 'set the owner PIN',
  'auth.pin_change': 'changed the owner PIN',
  'auth.pin_remove': 'removed the owner PIN',
  'auth.pin_unlock': 'unlocked owner actions',
  'auth.pin_failed': 'entered a wrong PIN',
  'auth.pin_lockout': 'PIN locked after 5 wrong attempts',
  'team.invite': 'invited',
  'team.invite_revoke': 'revoked the invite for',
  'team.join_code': 'generated a join code',
  'team.join': 'joined the team',
  'team.remove': 'removed',
  'team.role': 'changed the role of',
  'team.digest': 'changed the daily summary',
};

function describe(entry: AuditEntryDto): string {
  const base = ACTION_TEXT[entry.action] ?? entry.action;
  if (entry.action === 'auth.login') {
    const method = (entry.after as { method?: string } | null)?.method;
    return method && method !== 'password' ? `${base} (${method.replace('_', ' ')})` : base;
  }
  if (entry.action === 'auth.pin_unlock') {
    const window = (entry.after as { window?: string } | null)?.window;
    return window ? `${base} for ${window === 'session' ? 'the whole session' : `${window} min`}` : base;
  }
  return entry.entityLabel ? `${base} ${entry.entityLabel}` : base;
}

/** "18.000 RSD → 19.000 RSD" for a base-price change; variant price changes list the names. */
function priceLine(entry: AuditEntryDto, currency: string): string | null {
  const before = entry.before as Record<string, unknown> | null;
  const after = entry.after as Record<string, unknown> | null;
  if (typeof after?.priceCents === 'number') {
    const from = typeof before?.priceCents === 'number' ? `${formatPrice(before.priceCents, currency)} → ` : '';
    return `${from}${formatPrice(after.priceCents, currency)}`;
  }
  const changes = after?.priceChanges as { code?: string; name: string | null; from: number; to: number }[] | undefined;
  if (Array.isArray(changes) && changes.length) {
    return changes.map((c) => `${c.name ?? c.code ?? ''}: ${formatPrice(c.from, currency)} → ${formatPrice(c.to, currency)}`).join(' · ');
  }
  if (Array.isArray(after?.variants)) return 'variant prices changed';
  return null;
}

function availabilityLine(entry: AuditEntryDto): string | null {
  if (entry.action !== 'item.availability') return null;
  const after = entry.after as { isAvailable?: boolean; unavailableUntil?: string | null } | null;
  if (!after) return null;
  if (after.unavailableUntil) return `off until ${clock(after.unavailableUntil)}`;
  return after.isAvailable ? 'back on the menu' : 'switched off';
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

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

  const groups = items.reduce<{ key: string; label: string; entries: AuditEntryDto[] }[]>((acc, entry) => {
    const key = dayKey(entry.createdAt);
    const group = acc.find((g) => g.key === key);
    if (group) group.entries.push(entry);
    else acc.push({ key, label: dayLabel(entry.createdAt), entries: [entry] });
    return acc;
  }, []);

  const reset = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const filters = (
    <div className={cn('flex flex-col gap-3', isMobile ? 'px-4' : '')}>
      <div role="tablist" aria-label="Kind" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {AUDIT_KINDS.map((option) => (
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
      <div className={cn('bg-surface', isMobile ? 'border-y border-line' : 'overflow-hidden rounded-[10px] border border-line')}>
        {log.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading history" className="flex flex-col">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-14 items-center gap-3 border-b border-line-2 px-4">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3.5 w-[55%]" />
              </div>
            ))}
          </div>
        ) : log.isError ? (
          <EmptyState variant="inline" title="Could not load the history" description={errorMessage(log.error)} actions={<Button size="sm" onClick={() => void log.refetch()}>Try again</Button>} />
        ) : items.length === 0 ? (
          <EmptyState variant="inline" title="Nothing here yet." description="Changes, sign-ins and order actions will show up as they happen." />
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h2 className="sticky top-0 border-b border-line-2 bg-canvas px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{group.label}</h2>
              <ul>
                {group.entries.map((entry) => {
                  const price = entry.priceChange ? priceLine(entry, restaurant.currency) : null;
                  const availability = availabilityLine(entry);
                  const alarm = entry.action === 'auth.pin_failed' || entry.action === 'auth.pin_lockout';
                  return (
                    <li
                      key={entry.id}
                      data-price-change={entry.priceChange || undefined}
                      className={cn('flex gap-3 border-b border-line-2 px-4 py-2.5 last:border-b-0', entry.priceChange && 'bg-accent-soft', alarm && 'bg-[#FEF2F2]')}
                    >
                      <span className="w-11 shrink-0 pt-px text-[13px] tabular-nums text-muted">{clock(entry.createdAt)}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="text-sm">
                          <span className="font-medium">{entry.user?.name || 'System'}</span>
                          {entry.role ? <span className="text-muted"> · {entry.role}</span> : null}
                          {entry.elevated ? <Icon name="lock" size={11} strokeWidth={2.2} className="ml-1 inline text-accent" aria-label="with the owner PIN" /> : null}
                          <span className="text-ink-2"> {describe(entry)}</span>
                        </div>
                        {price ? <div className="text-[13px] font-semibold tabular-nums text-accent">{price}</div> : null}
                        {availability ? <div className="text-[13px] text-muted">{availability}</div> : null}
                        {entry.action === 'order.reject' && (entry.after as { rejectedReason?: string } | null)?.rejectedReason ? (
                          <div className="text-[13px] text-muted">“{(entry.after as { rejectedReason: string }).rejectedReason}”</div>
                        ) : null}
                      </div>
                      {entry.ip && !isMobile ? <span className="shrink-0 pt-px font-mono text-[11px] text-faint">{entry.ip}</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
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
