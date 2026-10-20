import { useSyncExternalStore } from 'react';

function listFor(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = listFor(query);
      if (!list) return () => undefined;
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => listFor(query)?.matches ?? false,
    () => false,
  );
}

/** ≤ 640px: bottom tab bar, full-screen sheets, swipe rows (design frames M1–M11). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)');
}

/** ≤ 1024px: the sidebar collapses to the 64px icon rail. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1024px)');
}

export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}
