import { NavLink, useLocation } from 'react-router';
import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n';
import { Icon, type IconName } from '../icons';
import { useOrdering } from '../orders/OrderingProvider';

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
  { label: 'More', icon: 'moreTab', to: 'more', active: (s) => s === 'more' || s === 'branding' || s === 'settings' || s === 'promotions' },
];

/** With ordering on, "Orders" takes the third slot and Analytics moves under More (design B9). */
const ORDERING_TABS: Tab[] = [
  TABS[0]!,
  TABS[1]!,
  { label: 'Orders', icon: 'orders', to: 'orders', active: (s) => s === 'orders' },
  { label: 'More', icon: 'moreTab', to: 'more', active: (s) => s === 'more' || s === 'branding' || s === 'settings' || s === 'analytics' || s === 'promotions' },
];

/** Bottom tab bar (design frames M2–M11). Home lives under the Menu tab. */
export function MobileTabBar({ restaurantId }: { restaurantId: string }) {
  const { pathname } = useLocation();
  const { t } = useT();
  const ordering = useOrdering();
  const segment = /^\/r\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  const tabs = ordering.enabled ? ORDERING_TABS : TABS;
  return (
    <nav
      aria-label="Primary"
      className="grid shrink-0 grid-cols-4 border-t border-line bg-surface px-2 pt-2 pb-[calc(10px+env(safe-area-inset-bottom,0px))]"
    >
      {tabs.map((tab) => {
        const active = tab.active(segment);
        const badge = tab.to === 'orders' ? ordering.counts.badge : 0;
        return (
          <NavLink
            key={tab.label}
            to={`/r/${restaurantId}${tab.to ? `/${tab.to}` : ''}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium no-underline',
              active ? 'text-accent' : 'text-muted',
            )}
          >
            <Icon name={tab.icon} size={22} strokeWidth={1.8} />
            {t(tab.label)}
            {badge > 0 ? (
              <span
                aria-label={`${badge} open`}
                className="absolute top-0.5 left-[calc(50%+6px)] inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-[5px] text-[11px] font-semibold leading-none text-on-accent tabular-nums"
              >
                {badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
