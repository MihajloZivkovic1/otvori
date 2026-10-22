import { Fragment, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { TableChip } from './Chips';
import { CloseIcon, SearchIcon } from './icons';
import { LogoTile } from './LogoTile';

export interface HeaderRestaurant {
  name: string;
  tagline: string | null;
  menuNote: string | null;
  logoUrl: string | null;
}

interface Props {
  restaurant: HeaderRestaurant;
  tableNumber: number | null;
  t: Dictionary;
  locale: UiLocale;
  locales: readonly UiLocale[];
  onSwitchLocale: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** "Your orders" link with the number of open orders (ordering only, once the session has placed one). */
  ordersLink?: { to: string; count: number } | null;
  /** Call-waiter bar / paused banner, rendered under the table chip row. */
  children?: ReactNode;
}

export function Header({
  restaurant,
  tableNumber,
  t,
  locale,
  locales,
  onSwitchLocale,
  searchOpen,
  onToggleSearch,
  query,
  onQueryChange,
  ordersLink = null,
  children,
}: Props) {
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onToggleSearch();
    }
  };

  return (
    <header className="safe-top flex flex-col gap-[18px] px-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <LogoTile name={restaurant.name} logoUrl={restaurant.logoUrl} />
          <div className="min-w-0">
            <h1 className="font-serif text-[21px] leading-[1.15] font-bold text-balance">{restaurant.name}</h1>
            {restaurant.tagline && <p className="mt-[3px] text-[13px] leading-[1.3] text-muted">{restaurant.tagline}</p>}
          </div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {locales.length > 1 && (
            <button
              type="button"
              onClick={onSwitchLocale}
              className="flex h-11 items-center gap-1 rounded-xl border border-line px-2 text-xs font-semibold text-ink"
            >
              {locales.map((code, index) => (
                <Fragment key={code}>
                  {index > 0 && (
                    <span className="font-normal text-muted" aria-hidden="true">
                      /
                    </span>
                  )}
                  <span className={code === locale ? undefined : 'font-medium text-muted'}>{code.toUpperCase()}</span>
                </Fragment>
              ))}
              <span className="sr-only">{t.switchLanguage}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label={t.search}
            aria-expanded={searchOpen}
            aria-controls="menu-search"
            className="grid size-11 place-items-center rounded-xl border border-line text-ink"
          >
            <SearchIcon />
          </button>
        </div>
      </div>

      {(tableNumber !== null || restaurant.menuNote || ordersLink) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {tableNumber !== null && <TableChip label={`${t.table} ${tableNumber}`} />}
            {restaurant.menuNote && <span className="truncate text-xs text-muted">{restaurant.menuNote}</span>}
          </div>
          {ordersLink && (
            <Link to={ordersLink.to} className="inline-flex h-11 flex-none items-center gap-1.5 text-[13px] font-semibold text-accent no-underline">
              {t.yourOrders}
              {ordersLink.count > 0 && (
                <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-[5px] text-[11px] font-semibold text-on-accent tabular-nums">
                  {ordersLink.count}
                </span>
              )}
            </Link>
          )}
        </div>
      )}

      {children}

      {searchOpen && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            id="menu-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus
            className="h-11 w-full rounded-xl border border-line bg-surface pr-11 pl-11 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus-visible:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={t.clearSearch}
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
