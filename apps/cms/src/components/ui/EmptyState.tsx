import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from '../icons';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** page = centred hero (menu is empty); inline = compact note inside a card (no items in category). */
  variant?: 'page' | 'inline';
  className?: string;
}

export function EmptyState({ icon = 'emptyMenu', title, description, actions, variant = 'page', className }: EmptyStateProps) {
  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col items-center gap-2 p-10 text-center text-muted', className)}>
        <span>{title}</span>
        {description ? <span className="text-[13px]">{description}</span> : null}
        {actions ? <div className="mt-1 flex gap-2">{actions}</div> : null}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-1 items-center justify-center p-10', className)}>
      <div className="flex w-full max-w-[420px] flex-col items-center gap-3 text-center">
        <div className="mb-2 grid size-16 place-items-center rounded-2xl border border-dashed border-line-strong text-faint max-tab:size-14 max-tab:rounded-[14px]">
          <Icon name={icon} size={24} strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-semibold leading-tight tracking-[-.01em] max-tab:text-lg">{title}</h2>
        {description ? <p className="text-pretty text-muted">{description}</p> : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
