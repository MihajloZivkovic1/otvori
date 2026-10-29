import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { MenuItemDto, TableDto } from '@qr-menu/shared';
import { useDebounced } from '../../hooks/useDebounced';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useAdminSearch } from '../../lib/admin';
import { useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { text } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { keys } from '../../lib/queries';
import { NAV } from '../../lib/screens';
import { Icon, type IconName } from '../icons';
import { createPortal } from 'react-dom';

export interface PaletteContext {
  /** Inside a venue: its id and default locale (items/tables come from the query cache). */
  venue?: { id: string; defaultLocale: string; name: string; isOwner: boolean };
  /** Inside the superadmin area: venues, users, items and tables across every venue come from the API. */
  admin?: boolean;
}

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

/**
 * ⌘K / Ctrl+K: one box for venues, items, tables, users and pages (Phase 13c). Venue results are filtered
 * client-side from what the shell already loaded; the admin area asks GET /api/superadmin/search.
 */
export function CommandPalette({ open, onClose, context }: { open: boolean; onClose: () => void; context: PaletteContext }) {
  // Remounted on every open, so the query and the cursor start fresh without syncing state in an effect.
  if (!open) return null;
  return <PaletteDialog onClose={onClose} context={context} />;
}

function PaletteDialog({ onClose, context }: { onClose: () => void; context: PaletteContext }) {
  const open = true;
  const navigate = useNavigate();
  const client = useQueryClient();
  const me = useMe();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const debounced = useDebounced(query.trim(), 200);
  const admin = useAdminSearch(context.admin ? debounced : '');
  useFocusTrap(ref, open, onClose);
  useLockBodyScroll(open);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const commands = useMemo<Command[]>(() => {
    const q = debounced.toLowerCase();
    const matches = (value: string) => value.toLowerCase().includes(q);
    const list: Command[] = [];
    if (context.venue) {
      const rid = context.venue.id;
      const pages: { key: string; label: string; icon: IconName }[] = NAV.map((item) => ({ key: item.key as string, label: t(item.label), icon: item.icon })).concat([
        { key: 'settings/modules', label: 'Modules', icon: 'settings' },
        { key: 'settings/history', label: 'Change history', icon: 'activity' },
        { key: 'menu/unavailable', label: 'Unavailable today', icon: 'unavailable' },
      ]);
      for (const page of pages) if (!q || matches(page.label)) list.push({ id: `page:${page.key}`, group: t('Pages'), label: page.label, icon: page.icon, run: () => go(`/r/${rid}/${page.key}`) });
      if (context.venue.isOwner && (!q || matches('new item') || matches(t('Add item')))) list.push({ id: 'new-item', group: t('Pages'), label: t('Add item'), icon: 'plus', run: () => go(`/r/${rid}/menu?item=new`) });
      if (q) {
        const items = client.getQueryData<MenuItemDto[]>(keys.items(rid)) ?? [];
        for (const item of items) {
          const name = text(item.name, context.venue.defaultLocale);
          if (matches(name)) list.push({ id: `item:${item.id}`, group: t('Items'), label: name, hint: item.isEffectivelyAvailable ? undefined : 'off today', icon: 'menu', run: () => go(`/r/${rid}/menu?c=${item.categoryId}&item=${item.id}`) });
        }
        const tables = client.getQueryData<TableDto[]>(keys.tables(rid)) ?? [];
        for (const table of tables) if (matches(table.label) || String(table.number) === q) list.push({ id: `table:${table.id}`, group: t('Tables'), label: table.label, hint: `#${table.number}`, icon: 'tables', run: () => go(`/r/${rid}/tables`) });
      }
      if (me.user.isSuperadmin && (!q || matches('superadmin'))) list.push({ id: 'admin', group: t('Pages'), label: t('Superadmin'), icon: 'shield', run: () => go('/admin/restaurants') });
    }
    if (context.admin) {
      const pages: { key: string; label: string; icon: IconName }[] = [
        { key: 'restaurants', label: t('Restaurants'), icon: 'venues' },
        { key: 'restaurants/new', label: t('New venue'), icon: 'plus' },
        { key: 'users', label: t('Users'), icon: 'users' },
        { key: 'activity', label: t('Activity'), icon: 'activity' },
        { key: 'system', label: t('System'), icon: 'server' },
      ];
      for (const page of pages) if (!q || matches(page.label)) list.push({ id: `page:${page.key}`, group: t('Pages'), label: page.label, icon: page.icon, run: () => go(`/admin/${page.key}`) });
      const data = admin.data;
      if (q && data) {
        for (const r of data.restaurants) list.push({ id: `venue:${r.id}`, group: t('Restaurants'), label: r.name, hint: [r.slug, r.city, r.status].filter(Boolean).join(' · '), icon: 'venues', run: () => go(`/admin/restaurants/${r.id}`) });
        for (const u of data.users) list.push({ id: `user:${u.id}`, group: t('Users'), label: u.name, hint: u.email, icon: 'user', run: () => go(`/admin/users?user=${u.id}`) });
        for (const i of data.items) list.push({ id: `item:${i.id}`, group: t('Items'), label: i.name, hint: i.restaurant.name, icon: 'menu', run: () => go(`/admin/restaurants/${i.restaurant.id}`) });
        for (const tb of data.tables) list.push({ id: `table:${tb.id}`, group: t('Tables'), label: tb.label, hint: `#${tb.number} · ${tb.restaurant.name}`, icon: 'tables', run: () => go(`/admin/restaurants/${tb.restaurant.id}`) });
      }
    }
    return list.slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, context, admin.data, client, me.user.isSuperadmin, t]);

  const current = Math.min(active, Math.max(0, commands.length - 1));
  const groups: { group: string; items: { command: Command; index: number }[] }[] = [];
  commands.forEach((command, index) => {
    const group = groups.find((g) => g.group === command.group);
    if (group) group.items.push({ command, index });
    else groups.push({ group: command.group, items: [{ command, index }] });
  });

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((n) => Math.min(commands.length - 1, n + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((n) => Math.max(0, n - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commands[current]?.run();
    }
  };

  let content: ReactNode;
  if (commands.length === 0) content = <div className="px-4 py-8 text-center text-[13px] text-muted">{admin.isPending && debounced ? '…' : t('Nothing found')}</div>;
  else
    content = groups.map((group) => (
      <div key={group.group} role="group" aria-label={group.group}>
        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{group.group}</div>
        {group.items.map(({ command, index }) => (
          <button
            key={command.id}
            type="button"
            role="option"
            aria-selected={index === current}
            id={`${listId}-${index}`}
            onMouseEnter={() => setActive(index)}
            onClick={command.run}
            className={cn('flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-[13px] text-ink', index === current && 'bg-line-2')}
          >
            <Icon name={command.icon} size={15} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">{command.label}</span>
            {command.hint ? <span className="shrink-0 truncate text-xs text-muted">{command.hint}</span> : null}
          </button>
        ))}
      </div>
    ));

  return createPortal(
    <div className="fade-enter fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(24,24,27,.4)] p-4 pt-[12vh]" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={t('Search')} onClick={(event) => event.stopPropagation()} className="pop-enter flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl bg-surface shadow-[0_24px_60px_rgba(0,0,0,.25)]">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={16} className="text-muted" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={commands.length ? `${listId}-${current}` : undefined}
            aria-label={t('Search')}
            autoComplete="off"
            placeholder={context.admin ? 'Venues, users, items, tables…' : 'Items, tables, pages…'}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            data-autofocus
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">esc</kbd>
        </div>
        <div id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {content}
        </div>
      </div>
    </div>,
    document.body,
  );
}
