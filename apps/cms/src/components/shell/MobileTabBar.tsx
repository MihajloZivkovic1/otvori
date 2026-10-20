import { NavLink, useLocation } from 'react-router';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from '../icons';

interface Tab {
  label: string;
  icon: IconName;
  to: string;
  active: (segment: string | undefined) => boolean;
}

const TABS: Tab[] = [
  { label: 'Menu', icon: 'menu', to: '', active: (s) => s === undefined || s === 'home' || s === 'menu' },
  { label: 'Tables', icon: 'tables', to: 'tables', active: (s) => s === 'tables' },
  { label: 'Analytics', icon: 'analytics', to: 'analytics', active: (s) => s === 'analytics' },
  { label: 'More', icon: 'moreTab', to: 'more', active: (s) => s === 'more' || s === 'branding' || s === 'settings' },
];

/** Bottom tab bar (design frames M2–M11). Home lives under the Menu tab. */
export function MobileTabBar({ restaurantId }: { restaurantId: string }) {
  const { pathname } = useLocation();
  const segment = /^\/r\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  return (
    <nav
      aria-label="Primary"
      className="grid shrink-0 grid-cols-4 border-t border-line bg-surface px-2 pt-2 pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
    >
      {TABS.map((tab) => {
        const active = tab.active(segment);
        return (
          <NavLink
            key={tab.label}
            to={`/r/${restaurantId}${tab.to ? `/${tab.to}` : ''}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium no-underline',
              active ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon name={tab.icon} size={22} strokeWidth={1.8} />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
