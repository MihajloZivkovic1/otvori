import { useState, type ReactNode } from 'react';
import { MODULES, PASSWORD_GENERATOR, type ModuleKey, type RestaurantModules, type RestaurantStatus, type SuperadminRestaurantDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { daysLeft, editedAt, relativeTime } from '../../lib/format';
import { Icon, type IconName } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { StatusDot, StatusPill, type StatusTone } from '../ui/Chip';
import { Modal } from '../ui/Modal';
import { Tooltip } from '../ui/Tooltip';

export const STATUS_TONE: Record<RestaurantStatus, StatusTone> = { active: 'success', trial: 'warning', suspended: 'danger' };

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Trial · 9 days left", "Trial · ended", "Pro". */
export function planLabel(row: Pick<SuperadminRestaurantDto, 'plan' | 'trialEndsAt'>): string {
  if (row.plan === 'trial') {
    const left = daysLeft(row.trialEndsAt);
    if (left === null) return 'Trial';
    if (left === 0) return 'Trial · ended';
    return `Trial · ${left} ${left === 1 ? 'day' : 'days'} left`;
  }
  return capitalize(row.plan);
}

export function StatusChip({ status, className }: { status: RestaurantStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', className)}>
      <StatusDot tone={STATUS_TONE[status]} />
      {capitalize(status)}
    </span>
  );
}

export function PublishedPill({ publishedAt, status }: { publishedAt: string | null; status: RestaurantStatus }) {
  if (status === 'suspended') return <StatusPill tone="danger">Suspended</StatusPill>;
  return publishedAt ? <StatusPill tone="success">Published</StatusPill> : <StatusPill tone="warning">Unpublished</StatusPill>;
}

const MODULE_ICON: Record<ModuleKey, IconName> = { ordering: 'orders', payments: 'receipt', pos: 'print' };
const MODULE_LABEL: Record<ModuleKey, string> = { ordering: 'Ordering', payments: 'Online payment', pos: 'POS' };

/** Three small icons (ordering / payments / POS); off ones are faint. */
export function ModuleIcons({ modules, size = 14 }: { modules: RestaurantModules; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Modules: ${MODULES.filter((m) => modules[m]).map((m) => MODULE_LABEL[m]).join(', ') || 'none'}`}>
      {MODULES.map((key) => (
        <Tooltip key={key} label={`${MODULE_LABEL[key]} ${modules[key] ? 'on' : 'off'}`}>
          <span className={cn('grid size-6 place-items-center rounded-md', modules[key] ? 'bg-accent-soft text-accent' : 'text-faint opacity-50')}>
            <Icon name={MODULE_ICON[key]} size={size} strokeWidth={1.9} />
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

/** "Today, 09:12" / "Never" for timestamps that may be null. */
export function when(iso: string | null): string {
  return iso ? editedAt(iso) : 'Never';
}

export function ago(iso: string | null): string {
  return relativeTime(iso);
}

/** A key/value grid for detail cards. */
export function Facts({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]', className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 truncate text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Stat tile for the overview grids. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{label}</span>
      <span className="text-[22px] font-semibold leading-tight tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Card({ title, description, actions, children, className, danger }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; danger?: boolean }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-[10px] border bg-surface p-5', danger ? 'border-danger-line' : 'border-line', className)}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="text-[13px] text-pretty text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Copies a string and says so for two seconds. */
export function CopyButton({ value, label = 'Copy', size = 'sm' }: { value: string; label?: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the value is visible anyway
    }
  };
  return (
    <Button size={size} icon={<Icon name={copied ? 'check' : 'copy'} size={13} />} onClick={() => void copy()} aria-live="polite">
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function CopyIcon({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? 'Copied' : label}
      size={28}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </IconButton>
  );
}

/** A random, readable password (no 0/O/1/l look-alikes). */
export function generatePassword(length = PASSWORD_GENERATOR.length): string {
  const alphabet = PASSWORD_GENERATOR.alphabet;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]!).join('');
}

/** Shows a link the admin can hand over (reset / magic link), with copy. */
export function LinkModal({ title, description, url, expiresAt, mailed, onClose }: { title: string; description?: ReactNode; url: string; expiresAt: string; mailed: boolean; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={title} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-3 text-sm text-ink-2">
        {description ? <p>{description}</p> : null}
        <p className="text-[13px] text-muted">
          {mailed ? 'It was also e-mailed to them. ' : 'This account has no real e-mail, so nothing was sent. '}
          Valid until {new Date(expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={url}>
            {url}
          </code>
          <CopyButton value={url} />
        </div>
      </div>
    </Modal>
  );
}
