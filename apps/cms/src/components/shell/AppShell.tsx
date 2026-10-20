import { useEffect, type ReactNode } from 'react';
import type { MembershipRole, RestaurantDto } from '@qr-menu/shared';
import { useIsCompact, useIsMobile } from '../../hooks/useMediaQuery';
import { InstallHint } from './InstallHint';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  restaurant: RestaurantDto | null;
  role: MembershipRole;
  /** Breadcrumb override (the superadmin list). */
  title?: string;
  children: ReactNode;
}

/**
 * Desktop/tablet: 240px sidebar (64px rail at ≤1024px) + 56px top bar + scrolling content column.
 * Phones (≤640px): content + bottom tab bar; every page draws its own header.
 */
export function AppShell({ restaurant, role, title, children }: AppShellProps) {
  const isMobile = useIsMobile();
  const compact = useIsCompact();

  // Drawers are portaled to <body>; this lets their scrim stop at the sidebar edge.
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', isMobile ? '0px' : compact ? '64px' : '240px');
  }, [isMobile, compact]);

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
        <InstallHint />
        {restaurant ? <MobileTabBar restaurantId={restaurant.id} /> : null}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar restaurant={restaurant} role={role} compact={compact} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar restaurant={restaurant} role={role} title={title} />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>
      </div>
    </div>
  );
}
