import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface ToastOptions {
  /** A button inside the toast ("Undo", "View"). */
  action?: { label: string; onClick: () => void };
  /** How long it stays (ms); errors default to 5 s, the rest 3.2 s, toasts with an action 6 s. */
  duration?: number;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind, options?: ToastOptions) => number;
  success: (message: string, options?: ToastOptions) => number;
  error: (message: string, options?: ToastOptions) => number;
  /** Remove a toast early (e.g. once its undo was used). */
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((item) => item.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info', options: ToastOptions = {}) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { id, kind, message, action: options.action }]);
      const duration = options.duration ?? (options.action ? 6000 : kind === 'error' ? 5000 : 3200);
      setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ toast, success: (m, o) => toast(m, 'success', o), error: (m, o) => toast(m, 'error', o), dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 tab:bottom-6"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pop-enter pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium shadow-[0_8px_30px_rgba(0,0,0,.18)]',
              item.kind === 'error' ? 'bg-[#B91C1C] text-white' : 'bg-ink text-surface',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                item.kind === 'success' ? 'bg-[#4ADE80]' : item.kind === 'error' ? 'bg-white' : 'bg-faint',
              )}
            />
            {item.message}
            {item.action ? (
              <button
                type="button"
                onClick={() => {
                  dismiss(item.id);
                  item.action!.onClick();
                }}
                className="ml-1 cursor-pointer rounded px-1.5 py-0.5 font-semibold underline underline-offset-2 hover:bg-white/10"
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
