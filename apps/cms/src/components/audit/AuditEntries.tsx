import type { AuditEntryDto, AuditKind } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { clock, formatPrice } from '../../lib/format';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

export const KIND_LABELS: Record<AuditKind, string> = {
  all: 'All',
  prices: 'Prices',
  menu: 'Menu',
  availability: 'Availability',
  orders: 'Orders & calls',
  auth: 'Sign-ins & PIN',
  team: 'Team',
  settings: 'Settings',
  admin: 'Superadmin',
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
  'table.bulk_create': 'created tables',
  'payment_config.update': 'changed the payment set-up',
  'pos_config.update': 'changed the POS set-up',
  'pos.sync': 'synced products from the register',
  'menu.import': 'imported the menu from a spreadsheet',
  'menu.copy': 'copied the menu from',
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
  'auth.impersonate': 'opened the venue as its owner',
  'auth.password_change': 'changed their password',
  'auth.sessions_revoke': 'signed out everywhere else',
  'team.invite': 'invited',
  'team.invite_revoke': 'revoked the invite for',
  'team.join_code': 'generated a join code',
  'team.join': 'joined the team',
  'team.remove': 'removed',
  'team.role': 'changed the role of',
  'team.digest': 'changed the daily summary',
  'admin.restaurant_create': 'created the venue',
  'admin.restaurant_update': 'changed plan, billing or settings of',
  'admin.restaurant_delete': 'deleted the venue',
  'admin.member_add': 'added member',
  'admin.member_role': 'changed the role of',
  'admin.member_remove': 'removed member',
  'admin.user_update': 'changed the account',
  'admin.user_reset_password': 'sent a password reset to',
  'admin.user_magic_link': 'sent a sign-in link to',
  'admin.user_deactivate': 'deactivated the account',
  'admin.user_activate': 'reactivated the account',
  'admin.welcome_email': 'sent the welcome e-mail to',
  'admin.pos_job_retry': 'retried a register job for',
};

export function describeEntry(entry: AuditEntryDto): string {
  const base = ACTION_TEXT[entry.action] ?? entry.action;
  if (entry.action === 'auth.login') {
    const method = (entry.after as { method?: string } | null)?.method;
    return method && method !== 'password' ? `${base} (${method.replace('_', ' ')})` : base;
  }
  if (entry.action === 'auth.pin_unlock') {
    const window = (entry.after as { window?: string } | null)?.window;
    return window ? `${base} for ${window === 'session' ? 'the whole session' : `${window} min`}` : base;
  }
  if (entry.action === 'table.bulk_create') {
    const count = (entry.after as { count?: number } | null)?.count;
    return count ? `created ${count} tables` : base;
  }
  if (entry.action === 'menu.import') {
    const after = entry.after as { itemsCreated?: number; categoriesCreated?: number } | null;
    return after ? `imported ${after.itemsCreated ?? 0} items in ${after.categoriesCreated ?? 0} new categories from a spreadsheet` : base;
  }
  return entry.entityLabel ? `${base} ${entry.entityLabel}` : base;
}

/** "18.000 RSD → 19.000 RSD" for a base-price change; variant price changes list the names. */
export function priceLine(entry: AuditEntryDto, currency: string): string | null {
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

export function availabilityLine(entry: AuditEntryDto): string | null {
  if (entry.action !== 'item.availability') return null;
  const after = entry.after as { isAvailable?: boolean; unavailableUntil?: string | null } | null;
  if (!after) return null;
  if (after.unavailableUntil) return `off until ${clock(after.unavailableUntil)}`;
  return after.isAvailable ? 'back on the menu' : 'switched off';
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

type Entry = AuditEntryDto & { restaurant?: { id: string; name: string } | null };

interface AuditEntriesProps {
  entries: Entry[];
  loading: boolean;
  error?: unknown;
  errorMessage?: string;
  onRetry?: () => void;
  currency?: string;
  /** Show the venue name on each row (global activity). */
  showVenue?: boolean;
  onVenueClick?: (restaurantId: string) => void;
  isMobile: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

/** The grouped-by-day list shared by the venue history, the superadmin activity screen and the venue's Activity tab. */
export function AuditEntries({ entries, loading, error, errorMessage, onRetry, currency = 'RSD', showVenue = false, onVenueClick, isMobile, emptyTitle = 'Nothing here yet.', emptyDescription, className }: AuditEntriesProps) {
  const groups = entries.reduce<{ key: string; label: string; entries: Entry[] }[]>((acc, entry) => {
    const key = dayKey(entry.createdAt);
    const group = acc.find((g) => g.key === key);
    if (group) group.entries.push(entry);
    else acc.push({ key, label: dayLabel(entry.createdAt), entries: [entry] });
    return acc;
  }, []);

  return (
    <div className={cn('bg-surface', isMobile ? 'border-y border-line' : 'overflow-hidden rounded-[10px] border border-line', className)}>
      {loading ? (
        <div role="status" aria-busy="true" aria-label="Loading history" className="flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-14 items-center gap-3 border-b border-line-2 px-4">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3.5 w-[55%]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState variant="inline" title="Could not load the history" description={errorMessage} actions={onRetry ? <Button size="sm" onClick={onRetry}>Try again</Button> : undefined} />
      ) : entries.length === 0 ? (
        <EmptyState variant="inline" title={emptyTitle} description={emptyDescription} />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2 className="sticky top-0 z-[1] border-b border-line-2 bg-canvas px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{group.label}</h2>
            <ul>
              {group.entries.map((entry) => {
                const price = entry.priceChange ? priceLine(entry, currency) : null;
                const availability = availabilityLine(entry);
                const alarm = entry.action === 'auth.pin_failed' || entry.action === 'auth.pin_lockout';
                const admin = entry.role === 'superadmin';
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
                        {entry.role ? <span className={cn('text-muted', admin && 'text-accent')}> · {entry.role}</span> : null}
                        {entry.elevated && !admin ? <Icon name="lock" size={11} strokeWidth={2.2} className="ml-1 inline text-accent" aria-label="with the owner PIN" /> : null}
                        <span className="text-ink-2"> {describeEntry(entry)}</span>
                        {showVenue && entry.restaurant ? (
                          <>
                            <span className="text-muted"> · </span>
                            {onVenueClick ? (
                              <button type="button" onClick={() => onVenueClick(entry.restaurant!.id)} className="cursor-pointer font-medium text-accent hover:underline">
                                {entry.restaurant.name}
                              </button>
                            ) : (
                              <span className="text-ink-2">{entry.restaurant.name}</span>
                            )}
                          </>
                        ) : showVenue ? (
                          <span className="text-muted"> · platform</span>
                        ) : null}
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
  );
}
