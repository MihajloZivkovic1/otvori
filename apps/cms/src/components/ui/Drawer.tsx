import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Icon } from '../icons';
import { IconButton } from './Button';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Right-hand editing drawer (480px, 420px at ≤1024px) covering the content column but not the sidebar. */
export function Drawer({ open, onClose, title, headerExtra, footer, children }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-y-0 right-0 z-40" style={{ left: 'var(--sidebar-w)' }}>
      <div className="fade-enter absolute inset-0 bg-[rgba(24,24,27,.25)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drawer-enter absolute inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-line bg-surface shadow-[-16px_0_40px_rgba(0,0,0,.08)] max-wide:w-[420px]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 id={titleId} className="text-[15px] font-semibold">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {headerExtra}
            <IconButton label="Close" onClick={onClose}>
              <Icon name="close" size={16} strokeWidth={1.8} />
            </IconButton>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-line bg-surface px-5 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
