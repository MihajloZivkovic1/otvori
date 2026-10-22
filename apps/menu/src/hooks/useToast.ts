import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastState {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

/** One transient message at a time (2.2 s, errors 3.5 s). */
export function useToast(): [ToastState | null, (message: string, kind?: ToastState['kind']) => void] {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, kind: ToastState['kind'] = 'ok') => {
    if (timer.current) window.clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, message, kind });
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 3500 : 2200);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return [toast, show];
}
