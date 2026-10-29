import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabDef<T extends string> {
  value: T;
  label: ReactNode;
  /** Small count next to the label. */
  count?: number;
  danger?: boolean;
}

interface TabsProps<T extends string> {
  tabs: ReadonlyArray<TabDef<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** Underlined tab bar (detail pages); ←/→ move between tabs, the panel is the caller's `role="tabpanel"`. */
export function Tabs<T extends string>({ tabs, value, onChange, label, className }: TabsProps<T>) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === value);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
    onChange(next.value);
    (event.currentTarget.querySelector(`[data-tab="${next.value}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-tab={tab.value}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors',
              active ? (tab.danger ? 'border-danger text-danger-text' : 'border-accent text-ink') : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-accent-soft text-accent' : 'bg-line-2 text-muted')}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
