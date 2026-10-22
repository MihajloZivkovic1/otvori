import { useEffect, useState } from 'react';

/** A clock that ticks every `intervalMs` so relative times ("2 min ago", "expires in 18 min") stay fresh. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
