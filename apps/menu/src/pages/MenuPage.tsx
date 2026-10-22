import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type { PublicMenuCategoryDto, PublicMenuItemDto, ServiceRequestType } from '@qr-menu/shared';
import { CartBar } from '../components/CartBar';
import type { CartSubmission, SubmitResult } from '../components/CartSheet';
import { CategoryBar } from '../components/CategoryBar';
import { CategorySection } from '../components/CategorySection';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import type { AddSelection } from '../components/ItemSheet';
import { MenuSkeleton } from '../components/MenuSkeleton';
import { OfflineScreen } from '../components/OfflineScreen';
import { OrderingBar } from '../components/OrderingBar';
import { TablePrompt } from '../components/TablePrompt';
import { Toast } from '../components/Toast';
import { useActiveCategory } from '../hooks/useActiveCategory';
import { useCart } from '../hooks/useCart';
import { useMenu } from '../hooks/useMenu';
import { useServiceCalls } from '../hooks/useServiceCalls';
import { useSessionOrders } from '../hooks/useSessionOrders';
import { useDocumentLang, useTenant, useTenantTheme } from '../hooks/useTenant';
import { useToast } from '../hooks/useToast';
import { ApiError, createOrder, menuErrorKind, orderingErrorMessage, type OrderPayload } from '../lib/api';
import { cartCount, cartTotal, priceCart } from '../lib/cart';
import { trackItemView, trackScan } from '../lib/events';
import { filterCategories, findItem } from '../lib/format';
import { dict } from '../lib/i18n';
import { nextLocale, rememberLocale, requestedLocale, resolveUiLocale, switchableLocales } from '../lib/locale';
import { openOrderCount, rememberOrder } from '../lib/orders';
import { orderPath } from '../lib/routes';
import { parseTableNumber, readStoredTableNumber, storeTableNumber } from '../lib/session';

/** Height of the sticky chip bar (8 + 44 + 8 + 1px border); sections scroll to just below it. */
const BAR_HEIGHT = 61;

// The sheets are interaction-only: they ship as their own chunks, prefetched once the menu is idle.
const loadItemSheet = () => import('../components/ItemSheet');
const ItemSheet = lazy(() => loadItemSheet().then((module) => ({ default: module.ItemSheet })));
const loadCartSheet = () => import('../components/CartSheet');
const CartSheet = lazy(() => loadCartSheet().then((module) => ({ default: module.CartSheet })));

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
const NO_LOCALES: string[] = [];

export function MenuPage() {
  const { slug: pathSlug, table: pathTable } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantKey, slug, cachedTenant } = useTenant(pathSlug);

  // Table QR codes encode /t/<number>; ?t=<number> is the older format and still accepted. A guest who arrived
  // without one may type it when calling the waiter or sending the cart.
  const tableParam = pathTable ?? searchParams.get('t');
  const [enteredTable, setEnteredTable] = useState<number | null>(null);
  const knownTable = useMemo(() => parseTableNumber(tableParam) ?? readStoredTableNumber(tenantKey), [tableParam, tenantKey]);
  const tableNumber = knownTable ?? enteredTable;
  useEffect(() => {
    if (tableNumber !== null) storeTableNumber(tenantKey, tableNumber);
  }, [tenantKey, tableNumber]);

  const requested = requestedLocale(searchParams);
  const menu = useMenu(slug, tenantKey, requested);
  const restaurant = menu.data?.restaurant ?? null;
  const locale = resolveUiLocale(requested, restaurant);
  const t = dict[locale];
  useDocumentLang(locale);
  useTenantTheme(restaurant, tenantKey);

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

  /* ------------------------------------------------------------------ ordering */

  const orderingMode = restaurant?.orderingMode ?? 'off';
  const paused = Boolean(restaurant?.orderingPaused);
  const canOrder = orderingMode === 'order' && !paused;
  const callsEnabled = orderingMode !== 'off';
  const cart = useCart(tenantKey);
  const pricedLines = useMemo(() => priceCart(cart.lines, categories), [cart.lines, categories]);
  const cartItems = cartCount(pricedLines.filter((line) => line.available));
  const sessionOrders = useSessionOrders(tenantKey);
  const calls = useServiceCalls(slug, tenantKey, t);
  const [toast, showToast] = useToast();
  const [tablePrompt, setTablePrompt] = useState<ServiceRequestType | null>(null);
  useEffect(() => (canOrder ? prefetchWhenIdle(loadCartSheet) : undefined), [canOrder]);

  const itemParam = searchParams.get('item');
  const openItem = useMemo(() => (itemParam ? findItem(categories, itemParam) : null), [categories, itemParam]);
  const cartOpen = canOrder && searchParams.get('cart') === '1';

  const pushParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(key, value);
          return next;
        },
        { state: { sheet: true } },
      );
    },
    [setSearchParams],
  );

  const openSheet = useCallback(
    (itemId: string) => {
      pushParam('item', itemId);
      trackItemView(slug, itemId);
    },
    [pushParam, slug],
  );
  const openCart = useCallback(() => pushParam('cart', '1'), [pushParam]);

  // Sheets are history entries (Back closes them); direct links to ?item= / ?cart= are closed with `replace`.
  const openedFromMenu = Boolean((location.state as { sheet?: boolean } | null)?.sheet);
  const closeOverlay = useCallback(() => {
    if (openedFromMenu) {
      void navigate(-1);
      return;
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('item');
        next.delete('cart');
        return next;
      },
      { replace: true },
    );
  }, [navigate, openedFromMenu, setSearchParams]);

  const addToCart = useCallback(
    (item: PublicMenuItemDto, selection: AddSelection) => {
      const added = cart.add({ itemId: item.id, ...selection });
      showToast(added ? `${t.added} · ${item.name}` : t.errors.cartFull, added ? 'ok' : 'error');
    },
    [cart, showToast, t],
  );

  // "+" on a row: items without variants go straight in; with variants the sheet asks which one.
  const onPlus = useCallback(
    (item: PublicMenuItemDto) => {
      if (item.variants.length > 0) openSheet(item.id);
      else addToCart(item, { variantId: null, quantity: 1, note: '' });
    },
    [addToCart, openSheet],
  );

  const submitOrder = useCallback(
    async (submission: CartSubmission): Promise<SubmitResult> => {
      const lines = pricedLines.filter((line) => line.available);
      const payload: OrderPayload = {
        tableNumber: submission.tableNumber,
        items: lines.map((line) => ({
          itemId: line.itemId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          quantity: line.quantity,
          ...(line.note ? { note: line.note } : {}),
        })),
        ...(submission.note ? { note: submission.note } : {}),
        ...(submission.guestName ? { guestName: submission.guestName } : {}),
        locale,
      };
      try {
        const order = await createOrder(slug, payload);
        storeTableNumber(tenantKey, submission.tableNumber);
        setEnteredTable(submission.tableNumber);
        rememberOrder(tenantKey, order);
        cart.clear();
        void navigate(orderPath(pathSlug, order.id), { replace: true });
        return { ok: true };
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'ITEM_UNAVAILABLE' || error.code === 'ORDERING_PAUSED')) {
          void menu.refetch(); // the menu changed under the guest: re-price the cart and re-evaluate the gates
        }
        const field = error instanceof ApiError && error.code === 'TABLE_NOT_FOUND' ? ('table' as const) : undefined;
        return { ok: false, message: orderingErrorMessage(error, t), ...(field ? { field } : {}) };
      }
    },
    [cart, locale, menu, navigate, pathSlug, pricedLines, slug, t, tenantKey],
  );

  const onCall = useCallback(
    async (type: ServiceRequestType, table: number | null = tableNumber) => {
      if (table === null) {
        setTablePrompt(type);
        return;
      }
      const result = await calls.call(type, table);
      if (!result.ok) showToast(result.message, 'error');
    },
    [calls, showToast, tableNumber],
  );

  const supportedLocales = restaurant?.supportedLocales ?? NO_LOCALES;
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
  const latestOrder = sessionOrders[0];
  const showCartBar = canOrder && cartItems > 0 && !cartOpen;

  return (
    <div className={`mx-auto min-h-dvh max-w-[640px] ${showCartBar ? 'pb-28' : 'pb-10'}`}>
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
        ordersLink={orderingMode === 'order' && latestOrder ? { to: orderPath(pathSlug, latestOrder.id), count: openOrderCount(sessionOrders) } : null}
      >
        {callsEnabled && (
          <OrderingBar
            t={t}
            remaining={calls.remaining}
            onCall={(type) => void onCall(type)}
            paused={orderingMode === 'order' && paused ? { message: current.pausedMessage } : null}
          />
        )}
      </Header>
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
              onAddItem={canOrder ? onPlus : null}
            />
          ))
        )}
      </main>
      <Footer />
      {showCartBar && (
        <CartBar count={cartItems} totalCents={cartTotal(pricedLines)} currency={current.currency} locale={locale} t={t} onOpen={openCart} />
      )}
      <Toast toast={toast} raised={showCartBar} />
      {openItem && (
        <Suspense fallback={null}>
          <ItemSheet
            item={openItem}
            currency={current.currency}
            locale={locale}
            t={t}
            onClose={closeOverlay}
            onAdd={
              canOrder
                ? (selection) => {
                    addToCart(openItem, selection);
                    closeOverlay();
                  }
                : null
            }
          />
        </Suspense>
      )}
      {cartOpen && (
        <Suspense fallback={null}>
          <CartSheet
            lines={pricedLines}
            currency={current.currency}
            locale={locale}
            t={t}
            tableNumber={tableNumber}
            onChangeQuantity={cart.setQuantity}
            onSubmit={submitOrder}
            onClose={closeOverlay}
          />
        </Suspense>
      )}
      {tablePrompt && (
        <TablePrompt
          t={t}
          onClose={() => setTablePrompt(null)}
          onConfirm={(number) => {
            setTablePrompt(null);
            storeTableNumber(tenantKey, number);
            setEnteredTable(number);
            void onCall(tablePrompt, number);
          }}
        />
      )}
    </div>
  );
}
