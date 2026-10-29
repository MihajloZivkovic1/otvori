import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { useIsCompact, useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth, useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { impersonationStore } from '../../lib/impersonation';
import { lastRestaurant } from '../../lib/storage';
import { Icon, type IconName } from '../icons';
import { OtvoriMark, Wordmark } from '../Wordmark';
import { IconButton } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Tooltip } from '../ui/Tooltip';

export type AdminSection = 'restaurants' | 'users' | 'activity' | 'system';

export const ADMIN_NAV: ReadonlyArray<{ key: AdminSection; label: string; icon: IconName }> = [
  { key: 'restaurants', label: 'Restaurants', icon: 'venues' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
  { key: 'system', label: 'System', icon: 'server' },
];

/** Second path segment of /admin/<section>/…, defaulting to restaurants. */
export function useAdminSection(): AdminSection {
  const { pathname } = useLocation();
  const segment = /^\/admin\/([^/]+)/.exec(pathname)?.[1];
  return ADMIN_NAV.some((item) => item.key === segment) ? (segment as AdminSection) : 'restaurants';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/**
 * /admin/* — the superadmin area is its own shell (Phase 13): no venue switcher, no venue nav, no publish pill.
 * Entering it forgets the "active venue" and ends any "Open as owner" session, so nothing from the last venue
 * leaks into the admin screens.
 */
export function AdminLayout() {
  const me = useMe();
  const section = useAdminSection();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!me.user.isSuperadmin) return;
    lastRestaurant.set(me.user.id, null);
    impersonationStore.clear();
  }, [me.user.id, me.user.isSuperadmin]);

  useEffect(() => {
    const label = ADMIN_NAV.find((item) => item.key === section)?.label ?? 'Superadmin';
    document.title = `${label} · Superadmin · otvori`;
  }, [section]);

  if (!me.user.isSuperadmin) return <Navigate to="/" replace />;

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-canvas">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
        <AdminTabBar section={section} />
      </div>
    );
  }
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <AdminSidebar section={section} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <AdminTopbar section={section} />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminSidebar({ section }: { section: AdminSection }) {
  const me = useMe();
  const { signOut } = useAuth();
  const compact = useIsCompact();
  const wide = !compact;
  return (
    <aside className={cn('relative z-30 flex shrink-0 flex-col border-r border-line bg-surface', wide ? 'w-60' : 'w-16')}>
      <div className={cn('flex h-14 items-center gap-2 border-b border-line', wide ? 'px-4' : 'justify-center px-0')}>
        {wide ? <Wordmark size={18} /> : <OtvoriMark size={22} className="text-accent" />}
        {wide ? <Badge className="ml-auto text-ink-2">SUPERADMIN</Badge> : null}
      </div>
      <nav aria-label="Superadmin sections" className="flex flex-col gap-0.5 px-3 py-3">
        {ADMIN_NAV.map((item) => {
          const link = (
            <NavLink
              key={item.key}
              to={`/admin/${item.key}`}
              aria-current={section === item.key ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium no-underline transition-colors',
                section === item.key ? 'bg-line-2 text-ink' : 'text-ink-2 hover:bg-line-2 hover:text-ink',
                !wide && 'w-10 justify-center px-0',
              )}
            >
              <Icon name={item.icon} size={18} className="shrink-0" />
              {wide ? <span className="flex-1">{item.label}</span> : <span className="sr-only">{item.label}</span>}
            </NavLink>
          );
          return wide ? (
            link
          ) : (
            <Tooltip key={item.key} label={item.label}>
              {link}
            </Tooltip>
          );
        })}
      </nav>
      <div className={cn('mt-auto flex items-center gap-2.5 border-t border-line p-3', !wide && 'flex-col')}>
        <div className="grid size-7 shrink-0 place-items-center rounded-full bg-line text-[11px] font-semibold text-ink-2" title={me.user.name} aria-hidden="true">
          {initials(me.user.name)}
        </div>
        {wide ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{me.user.name}</div>
            <div className="truncate text-xs text-muted">{me.user.email}</div>
          </div>
        ) : null}
        {wide ? (
          <IconButton label="Sign out" size={28} onClick={() => void signOut()}>
            <Icon name="signOut" size={16} />
          </IconButton>
        ) : (
          <Tooltip label="Sign out">
            <IconButton label="Sign out" size={28} onClick={() => void signOut()}>
              <Icon name="signOut" size={16} />
            </IconButton>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}

/** Breadcrumb "Superadmin / Restaurants"; pages add a third crumb through `AdminCrumb`. */
function AdminTopbar({ section }: { section: AdminSection }) {
  const label = ADMIN_NAV.find((item) => item.key === section)?.label ?? 'Restaurants';
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
        <span className="truncate">Superadmin</span>
        <span className="text-line-strong" aria-hidden="true">
          /
        </span>
        <NavLink to={`/admin/${section}`} end className={({ isActive }) => cn('truncate no-underline', isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink')}>
          {label}
        </NavLink>
        <AdminCrumbOutlet />
      </nav>
      <div id="admin-topbar-actions" className="flex items-center gap-2" />
    </header>
  );
}

/** Pages set a third crumb by rendering `<AdminCrumb>`; the top bar shows it after the section. */
let crumbListeners = new Set<() => void>();
let crumb: ReactNode = null;
export function setAdminCrumb(next: ReactNode): void {
  crumb = next;
  crumbListeners.forEach((listener) => listener());
}
function AdminCrumbOutlet() {
  const value = useSyncExternalStore(
    (listener) => {
      crumbListeners.add(listener);
      return () => {
        crumbListeners.delete(listener);
      };
    },
    () => crumb,
    () => null,
  );
  if (!value) return null;
  return (
    <>
      <span className="text-line-strong" aria-hidden="true">
        /
      </span>
      <span className="truncate font-semibold text-ink">{value}</span>
    </>
  );
}
export function AdminCrumb({ children }: { children: ReactNode }) {
  useEffect(() => {
    setAdminCrumb(children);
    return () => setAdminCrumb(null);
  }, [children]);
  return null;
}
export function resetAdminCrumbsForTests(): void {
  crumbListeners = new Set();
  crumb = null;
}

function AdminTabBar({ section }: { section: AdminSection }) {
  return (
    <nav aria-label="Primary" className="grid shrink-0 grid-cols-4 border-t border-line bg-surface px-2 pt-2 pb-[calc(10px+env(safe-area-inset-bottom,0px))]">
      {ADMIN_NAV.map((item) => {
        const active = section === item.key;
        return (
          <NavLink
            key={item.key}
            to={`/admin/${item.key}`}
            aria-current={active ? 'page' : undefined}
            className={cn('flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium no-underline', active ? 'text-accent' : 'text-muted')}
          >
            <Icon name={item.icon} size={22} strokeWidth={1.8} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
