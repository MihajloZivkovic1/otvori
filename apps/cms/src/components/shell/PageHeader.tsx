import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Desktop page heading: 20px/600 title, 13px muted subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div>
        <h1 className="text-xl font-semibold leading-tight tracking-[-.01em]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

interface MobileHeaderProps {
  title: ReactNode;
  /** Route for the back chevron; omit for top-level tabs. */
  backTo?: string;
  action?: ReactNode;
  /** Large 22px title without a back button (Tables & QR, More). */
  large?: boolean;
  className?: string;
}

export function MobileHeader({ title, backTo, action, large, className }: MobileHeaderProps) {
  const navigate = useNavigate();
  if (large) {
    return (
      <div className={cn('safe-top flex items-center justify-between pb-2 pl-5 pr-4', className)}>
        <h1 className="text-[22px] font-semibold tracking-[-.01em]">{title}</h1>
        {action}
      </div>
    );
  }
  return (
    <div className={cn('safe-top flex items-center justify-between pb-2 pl-2 pr-3', className)}>
      {backTo ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(backTo)}
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink"
        >
          <Icon name="back" size={20} strokeWidth={2} />
        </button>
      ) : (
        <span className="w-11" />
      )}
      <h1 className="text-[17px] font-semibold">{title}</h1>
      <div className="flex min-w-11 justify-end">{action}</div>
    </div>
  );
}
