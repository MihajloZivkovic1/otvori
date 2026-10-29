import { useSyncExternalStore } from 'react';
import type { CmsTheme } from '@qr-menu/shared';
import { cmsTheme as stored } from './storage';

/**
 * CMS appearance (Phase 13c): `system` keeps the designed behaviour (dark follows the device on phones only),
 * `light` / `dark` force one everywhere via `data-theme` on <html> (styles.css).
 */
const listeners = new Set<() => void>();

export function applyTheme(theme: CmsTheme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export const themeStore = {
  get: (): CmsTheme => stored.get(),
  set(theme: CmsTheme): void {
    stored.set(theme);
    applyTheme(theme);
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useTheme(): [CmsTheme, (theme: CmsTheme) => void] {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => 'system' as CmsTheme);
  return [theme, themeStore.set];
}

/** `t()` keys: the system option reads "System theme" so it does not collide with the admin "System" section. */
export const THEME_LABELS: Record<CmsTheme, string> = { system: 'System theme', light: 'Light', dark: 'Dark' };
