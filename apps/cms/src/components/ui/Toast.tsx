import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), kind === 'error' ? 5000 : 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ toast, success: (m) => toast(m, 'success'), error: (m) => toast(m, 'error') }),
    [toast],
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
