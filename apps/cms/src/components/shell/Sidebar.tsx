import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import type { MembershipRole, RestaurantDto } from '@qr-menu/shared';
import { RESTAURANT_DEFAULTS } from '@qr-menu/shared';
import { useAuth, useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { NAV, restaurantPath, useScreen } from '../../lib/screens';
import { Icon } from '../icons';
import { LogoTile } from '../LogoTile';
import { IconButton } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Tooltip } from '../ui/Tooltip';

interface SidebarProps {
  restaurant: RestaurantDto | null;
  role: MembershipRole;
  compact: boolean;
}

function roleLabel(role: MembershipRole, superadmin: boolean): string {
  if (superadmin) return 'Superadmin';
  return role === 'owner' ? 'Owner' : 'Staff';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Sidebar({ restaurant, role, compact }: SidebarProps) {
  const me = useMe();
  const { signOut } = useAuth();
  const wide = !compact;

  return (
    <aside className={cn('relative z-30 flex shrink-0 flex-col border-r border-line bg-surface', wide ? 'w-60' : 'w-16')}>
      <div className="relative p-3">
        <VenueSwitcher restaurant={restaurant} wide={wide} />
      </div>
      {restaurant ? (
        <nav aria-label="Sections" className="flex flex-col gap-0.5 px-3 py-1">
          {NAV.map((item) => {
            const link = (
              <NavLink
                key={item.key}
                to={`/r/${restaurant.id}/${item.key}`}
                title={wide ? undefined : item.label}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium no-underline transition-colors',
                    isActive ? 'bg-line-2 text-ink' : 'text-ink-2 hover:bg-line-2 hover:text-ink',
                    !wide && 'w-10 justify-center px-0',
                  )
                }
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
      ) : null}
      <div className={cn('mt-auto flex items-center gap-2.5 border-t border-line p-3', !wide && 'flex-col')}>
        <div
          className="grid size-7 shrink-0 place-items-center rounded-full bg-line text-[11px] font-semibold text-ink-2"
          title={me.user.name}
          aria-hidden="true"
        >
          {initials(me.user.name)}
        </div>
        {wide ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{me.user.name}</div>
            <div className="text-xs text-muted">{roleLabel(role, me.user.isSuperadmin)}</div>
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

function VenueSwitcher({ restaurant, wide }: { restaurant: RestaurantDto | null; wide: boolean }) {
  const me = useMe();
  const navigate = useNavigate();
  const screen = useScreen();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onSuperadmin = screen === 'superadmin';
  const current = restaurant
    ? { name: restaurant.name, color: restaurant.primaryColor, logoUrl: restaurant.logoUrl }
    : { name: 'All restaurants', color: RESTAURANT_DEFAULTS.primaryColor, logoUrl: null };

  const pick = (id: string) => {
    setOpen(false);
    navigate(restaurantPath(id, onSuperadmin ? 'menu' : screen));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={wide ? undefined : `Switch venue (${current.name})`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border border-line bg-surface text-left text-ink hover:bg-line-2',
          wide ? 'px-2' : 'justify-center px-0',
        )}
      >
        <LogoTile name={current.name} color={current.color} logoUrl={current.logoUrl} size={24} radius={6} />
        {wide ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{current.name}</span>
            <Icon name="chevronsUpDown" size={14} className="text-muted" />
          </>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Your venues"
          className="pop-enter absolute left-0 top-11 z-20 flex w-[264px] flex-col gap-0.5 rounded-[10px] border border-line bg-surface p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.12)]"
        >
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Your venues</div>
          {me.memberships.map((membership) => {
            const venue = membership.restaurant;
            const active = !onSuperadmin && venue.id === restaurant?.id;
            return (
              <button
                key={membership.id}
                type="button"
                role="menuitem"
                onClick={() => pick(venue.id)}
                className={cn(
                  'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-ink hover:bg-line-2',
                  active && 'bg-line-2',
                )}
              >
                <LogoTile name={venue.name} color={venue.primaryColor} logoUrl={venue.logoUrl} size={20} radius={5} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{venue.name}</span>
                <span className="text-xs text-muted">{membership.role === 'owner' ? 'Owner' : 'Staff'}</span>
              </button>
            );
          })}
          {me.memberships.length === 0 ? <div className="px-2.5 py-2 text-xs text-muted">No venues yet</div> : null}
          <div className="my-1 h-px bg-line" aria-hidden="true" />
          {me.user.isSuperadmin ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/superadmin');
              }}
              className={cn(
                'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-ink hover:bg-line-2',
                onSuperadmin && 'bg-line-2',
              )}
            >
              All restaurants
              <Badge className="ml-auto text-ink-2">SUPERADMIN</Badge>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled
            title="Coming soon"
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-accent disabled:cursor-default disabled:opacity-70"
          >
            + Add a venue
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-[.04em] text-faint">Soon</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
