import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { cn } from '../../lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** full = M7-style full-screen modal with its own header; bottom = action sheet rising from the bottom. */
  variant?: 'full' | 'bottom';
  /** Rendered as the header (full variant): usually Cancel · Title · Action. */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, variant = 'full', header, footer, children, className }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  useLockBodyScroll(open);
  if (!open) return null;

  if (variant === 'bottom') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="fade-enter absolute inset-0 bg-[rgba(24,24,27,.4)]" onClick={onClose} aria-hidden="true" />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'sheet-enter relative flex max-h-[85dvh] flex-col rounded-t-[20px] bg-surface pb-[calc(16px+env(safe-area-inset-bottom,0px))]',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong" aria-hidden="true" />
          <h2 id={titleId} className="px-5 pb-2 pt-3 text-[17px] font-semibold">
            {title}
          </h2>
          <div className="min-h-0 flex-1 overflow-auto px-4">{children}</div>
          {footer}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn('sheet-enter fixed inset-0 z-50 flex flex-col bg-surface text-ink', className)}
    >
      {header ?? (
        <header className="safe-top flex items-center justify-between border-b border-line px-4 pb-2">
          <h2 id={titleId} className="text-[17px] font-semibold">
            {title}
          </h2>
        </header>
      )}
      {header ? (
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {footer}
    </div>,
    document.body,
  );
}
