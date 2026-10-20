import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  /** accent = allergen style (soft accent fill), ink = tag style (solid ink fill). */
  tone?: 'accent' | 'ink';
  size?: 'md' | 'lg';
  glyph?: ReactNode;
}

/** Toggle pill used for allergens and tags (drawer: 32px, mobile sheet: 40px). */
export function Chip({ selected, tone = 'accent', size = 'md', glyph, className, children, type = 'button', ...rest }: ChipProps) {
  const large = size === 'lg';
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex cursor-pointer items-center rounded-full border font-medium transition-colors',
        large ? 'h-10 gap-2 text-sm' : 'h-8 gap-1.5 text-[13px]',
        glyph ? (large ? 'pl-1.5 pr-3' : 'pl-1.5 pr-2.5') : large ? 'px-4' : 'px-3',
        tone === 'accent' &&
          (selected ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink hover:bg-line-2'),
        tone === 'ink' &&
          (selected ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink hover:bg-line-2'),
        className,
      )}
      {...rest}
    >
      {glyph ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-full font-semibold',
            large ? 'size-7 text-[11px]' : 'size-5 text-[10px]',
            selected ? 'bg-accent text-on-accent' : 'bg-line-2 text-ink-2',
          )}
        >
          {glyph}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** Tiny uppercase tag in item rows ("VEGAN", "NEW"). */
export function MiniTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-sm bg-line-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.04em] text-ink-2',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "HIDDEN", "SUPERADMIN", "OPENS PDF". */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('rounded-sm bg-line-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-[.04em] text-muted', className)}>
      {children}
    </span>
  );
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';
const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-faint',
};

/** Dot + label pill ("Published", "Live"). */
export function StatusPill({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-md bg-line-2 px-2.5 text-xs text-ink-2', className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[tone])} />
      {children}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-[7px] rounded-full', DOT[tone], className)} />;
}
