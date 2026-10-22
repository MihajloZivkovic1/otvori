import type { ToastState } from '../hooks/useToast';
import { CheckIcon } from './icons';

/** Transient confirmation ("Added to cart · Cortado"); sits above the cart bar when one is shown. */
export function Toast({ toast, raised }: { toast: ToastState | null; raised: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-4 z-40 mx-auto max-w-[608px] transition-[bottom] ${raised ? 'bottom-[92px]' : 'bottom-5'}`}
    >
      {toast && (
        <div
          key={toast.id}
          className={`scrim-enter flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm font-medium shadow-[0_8px_24px_rgba(31,26,23,.16),0_0_0_1px_var(--line)] ${
            toast.kind === 'error' ? 'bg-bad-soft text-bad' : 'bg-surface text-ink'
          }`}
        >
          {toast.kind === 'ok' && <CheckIcon className="flex-none text-ok" />}
          <span className="min-w-0 flex-1 truncate">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
