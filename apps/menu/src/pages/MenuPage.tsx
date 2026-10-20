import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PublicMenuCategoryDto } from '@qr-menu/shared';
import { CategoryBar } from '../components/CategoryBar';
import { CategorySection } from '../components/CategorySection';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { MenuSkeleton } from '../components/MenuSkeleton';
import { OfflineScreen } from '../components/OfflineScreen';
import { useActiveCategory } from '../hooks/useActiveCategory';
import { useMenu } from '../hooks/useMenu';
import { API_SAME_ORIGIN, menuErrorKind } from '../lib/api';
import { trackItemView, trackScan } from '../lib/events';
import { filterCategories, findItem } from '../lib/format';
import { dict } from '../lib/i18n';
import { nextLocale, rememberLocale, requestedLocale, resolveUiLocale, switchableLocales } from '../lib/locale';
import { parseTableNumber, readStoredTableNumber, storeTableNumber } from '../lib/session';
import { readCachedTenant, resolveTenant, tenantKeyFor, writeCachedTenant } from '../lib/tenant';
import { applyTheme } from '../lib/theme';

/** Height of the sticky chip bar (8 + 44 + 8 + 1px border); sections scroll to just below it. */
const BAR_HEIGHT = 61;

// The detail sheet is interaction-only: it ships as its own chunk, prefetched once the menu is idle.
const loadItemSheet = () => import('../components/ItemSheet');
const ItemSheet = lazy(() => loadItemSheet().then((module) => ({ default: module.ItemSheet })));

function prefetchWhenIdle(load: () => Promise<unknown>): () => void {
  const run = () => void load().catch(() => undefined);
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1200);
  return () => window.clearTimeout(handle);
}
const NO_CATEGORIES: PublicMenuCategoryDto[] = [];

export function MenuPage() {
  const { slug: pathSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const tenant = useMemo(() => resolveTenant(pathSlug), [pathSlug]);
  const tenantKey = useMemo(() => tenantKeyFor(tenant.slug), [tenant]);
  // Host-derived slug + same-origin API → host-based URLs (/api/public/menu), the form the HTML preloads.
  const slug = tenant.source === 'host' && API_SAME_ORIGIN ? null : tenant.slug;

  const tableParam = searchParams.get('t');
  const tableNumber = useMemo(
    () => parseTableNumber(tableParam) ?? readStoredTableNumber(tenantKey),
    [tableParam, tenantKey],
  );
  useEffect(() => {
    if (tableNumber !== null) storeTableNumber(tenantKey, tableNumber);
  }, [tenantKey, tableNumber]);

  const requested = requestedLocale(searchParams);
  const menu = useMenu(slug, tenantKey, requested);
  const cachedTenant = useMemo(() => readCachedTenant(tenantKey), [tenantKey]);
  const restaurant = menu.data?.restaurant ?? null;
  const locale = resolveUiLocale(requested, restaurant);
  const t = dict[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!restaurant) return;
    applyTheme(restaurant.theme, restaurant.primaryColor);
    writeCachedTenant(tenantKey, restaurant);
  }, [restaurant, tenantKey]);

  const loadedSlug = menu.data?.restaurant.slug;
  useEffect(() => {
    if (loadedSlug) trackScan(slug, tenantKey, tableNumber);
  }, [loadedSlug, slug, tenantKey, tableNumber]);
  useEffect(() => (loadedSlug ? prefetchWhenIdle(loadItemSheet) : undefined), [loadedSlug]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const categories = menu.data?.categories ?? NO_CATEGORIES;
  const visibleCategories = useMemo(() => filterCategories(categories, query), [categories, query]);
  const categoryIds = useMemo(() => visibleCategories.map((category) => category.id), [visibleCategories]);
  const { active, scrollTo } = useActiveCategory(categoryIds, BAR_HEIGHT);

  const itemParam = searchParams.get('item');
  const openItem = useMemo(() => (itemParam ? findItem(categories, itemParam) : null), [categories, itemParam]);

  const openSheet = useCallback(
    (itemId: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('item', itemId);
          return next;
        },
        { state: { sheet: true } },
      );
      trackItemView(slug, itemId);
    },
    [setSearchParams, slug],
  );

  const openedFromMenu = Boolean((location.state as { sheet?: boolean } | null)?.sheet);
  const closeSheet = useCallback(() => {
    if (openedFromMenu) {
      void navigate(-1);
      return;
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('item');
        return next;
      },
      { replace: true },
    );
  }, [navigate, openedFromMenu, setSearchParams]);

  const supportedLocales = restaurant?.supportedLocales ?? [];
  const switchLocale = useCallback(() => {
    const next = nextLocale(locale, supportedLocales);
    if (!next) return;
    rememberLocale(next);
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.set('lang', next);
        return params;
      },
      { replace: true },
    );
  }, [locale, setSearchParams, supportedLocales]);

  const toggleSearch = () => {
    if (searchOpen) setQuery('');
    setSearchOpen(!searchOpen);
  };

  if (!menu.data) {
    if (menu.isError) {
      return (
        <OfflineScreen
          kind={menuErrorKind(menu.error)}
          t={t}
          tenant={cachedTenant}
          onRetry={() => void menu.refetch()}
          retrying={menu.isFetching}
        />
      );
    }
    return <MenuSkeleton t={t} tenant={cachedTenant} />;
  }

  const { restaurant: current } = menu.data;

  return (
    <div className="mx-auto min-h-dvh max-w-[640px] pb-10">
      <title>{`${current.name} · salveta`}</title>
      <Header
        restaurant={current}
        tableNumber={tableNumber}
        t={t}
        locale={locale}
        locales={switchableLocales(current.supportedLocales)}
        onSwitchLocale={switchLocale}
        searchOpen={searchOpen}
        onToggleSearch={toggleSearch}
        query={query}
        onQueryChange={setQuery}
      />
      {visibleCategories.length > 0 && (
        <CategoryBar categories={visibleCategories} activeId={active} onSelect={scrollTo} t={t} />
      )}
      <main>
        {visibleCategories.length === 0 ? (
          <p className="px-5 py-12 text-center text-[15px] text-muted text-pretty">{query ? t.noResults : t.emptyMenu}</p>
        ) : (
          visibleCategories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              currency={current.currency}
              locale={locale}
              t={t}
              onOpenItem={openSheet}
            />
          ))
        )}
      </main>
      <Footer />
      {openItem && (
        <Suspense fallback={null}>
          <ItemSheet item={openItem} currency={current.currency} locale={locale} t={t} onClose={closeSheet} />
        </Suspense>
      )}
    </div>
  );
}
