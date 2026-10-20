import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { Button, IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Remove the body padding (print preview). */
  flush?: boolean;
}

const WIDTH = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' } as const;

export function Modal({ open, onClose, title, subtitle, size = 'sm', headerActions, footer, children, flush }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  useLockBodyScroll(open);
  if (!open) return null;

  return createPortal(
    <div className="fade-enter fixed inset-0 z-50 grid place-items-center bg-[rgba(24,24,27,.4)] p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'pop-enter flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-xl bg-surface text-ink shadow-[0_24px_60px_rgba(0,0,0,.25)]',
          WIDTH[size],
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h2 id={titleId} className="truncate text-[15px] font-semibold">
              {title}
            </h2>
            {subtitle ? <span className="truncate text-[13px] text-muted">{subtitle}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {headerActions ? null : (
              <IconButton label="Close" onClick={onClose}>
                <Icon name="close" size={16} strokeWidth={1.8} />
              </IconButton>
            )}
          </div>
        </header>
        <div className={cn('min-h-0 flex-1 overflow-auto', !flush && 'p-5')}>{children}</div>
        {footer ? <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <div className="text-sm text-ink-2">{description}</div> : null}
    </Modal>
  );
}
