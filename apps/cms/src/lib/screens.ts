import { useLocation } from 'react-router';
import type { IconName } from '../components/icons';

export type Screen = 'menu' | 'tables' | 'orders' | 'branding' | 'analytics' | 'settings';

/** Sidebar order. `orders` is only shown while the venue's orderingMode is not `off` (see Sidebar / MobileTabBar). */
export const NAV: ReadonlyArray<{ key: Screen; label: string; icon: IconName }> = [
  { key: 'menu', label: 'Menu', icon: 'menu' },
  { key: 'tables', label: 'Tables & QR', icon: 'tables' },
  { key: 'orders', label: 'Orders', icon: 'orders' },
  { key: 'branding', label: 'Branding', icon: 'branding' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const TITLES: Record<string, string> = {
  menu: 'Menu',
  tables: 'Tables & QR',
  orders: 'Orders',
  branding: 'Branding',
  analytics: 'Analytics',
  settings: 'Settings',
  home: 'Home',
  more: 'More',
  superadmin: 'All restaurants',
};

/** Third path segment of /r/:restaurantId/<screen>, or "superadmin". */
export function useScreen(): string | null {
  const { pathname } = useLocation();
  if (pathname.startsWith('/superadmin')) return 'superadmin';
  const match = /^\/r\/[^/]+\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

export function screenTitle(screen: string | null): string {
  return (screen && TITLES[screen]) ?? 'Menu';
}

export function restaurantPath(restaurantId: string, screen: string | null): string {
  return `/r/${restaurantId}${screen && screen in TITLES && screen !== 'superadmin' ? `/${screen}` : ''}`;
}
