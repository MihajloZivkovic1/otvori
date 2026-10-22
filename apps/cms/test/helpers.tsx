import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import type {
  AnalyticsDto,
  AuthResponseDto,
  CategoryDto,
  MeDto,
  MembershipDto,
  MenuItemDto,
  OrderDto,
  OrderingEvent,
  OrderingMode,
  RestaurantDto,
  ServiceRequestDto,
  SuperadminRestaurantDto,
  TableDto,
  UpdateOrderStatusInput,
  UserDto,
} from '@qr-menu/shared';
import { ToastProvider } from '../src/components/ui/Toast';
import { AuthProvider } from '../src/lib/auth';
import { routes } from '../src/router';

/* ------------------------------------------------------------------ viewport (matchMedia stub) */

export type Viewport = 'desktop' | 'tablet' | 'mobile';
let viewport: Viewport = 'desktop';

function evaluate(query: string): boolean {
  const maxWidth = /max-width:\s*(\d+)px/.exec(query);
  if (maxWidth) {
    const width = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 1024 : 1440;
    return width <= Number(maxWidth[1]);
  }
  return false;
}

/** Installs a matchMedia stub so useIsMobile()/useIsCompact() follow the chosen frame size. */
export function setViewport(next: Viewport): void {
  viewport = next;
  window.matchMedia = ((query: string) => ({
    matches: evaluate(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/* ------------------------------------------------------------------ fixtures */

export const ids = {
  restaurant: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f',
  coffee: '11111111-1111-4111-8111-111111111111',
  breakfast: '22222222-2222-4222-8222-222222222222',
  seasonal: '33333333-3333-4333-8333-333333333333',
  espresso: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  cappuccino: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  avocado: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  table7: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  order142: '14214214-2142-4142-8142-142142142142',
  order143: '14314314-3143-4143-8143-143143143143',
  order141: '14114114-1141-4141-8141-141141141141',
  order140: '14014014-0140-4140-8140-140140140140',
  call4: 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11',
  bill8: 'b111b111-b111-4111-8111-b111b111b111',
  user: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  admin: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  membership: '99999999-9999-4999-8999-999999999999',
};

export const user: UserDto = {
  id: ids.user,
  email: 'ana@kafeterija.rs',
  name: 'Ana Petrović',
  isSuperadmin: false,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const superadmin: UserDto = { ...user, id: ids.admin, email: 'admin@otvori.menu', name: 'otvori admin', isSuperadmin: true };

export const restaurant: RestaurantDto = {
  id: ids.restaurant,
  slug: 'kafeterija',
  name: 'Kafeterija Dorćol',
  tagline: 'Specialty coffee & breakfast',
  menuNote: 'Kitchen until 16:00',
  logoUrl: null,
  primaryColor: '#7A3E48',
  theme: 'light',
  currency: 'RSD',
  defaultLocale: 'sr',
  supportedLocales: ['sr', 'en'],
  timezone: 'Europe/Belgrade',
  address: 'Cara Dušana 12',
  city: 'Beograd',
  status: 'active',
  plan: 'pro',
  trialEndsAt: null,
  publishedAt: '2026-09-01T10:00:00.000Z',
  publicUrl: 'http://kafeterija.localhost:5174',
  modules: { ordering: false, payments: false, pos: false },
  paymentConfig: { provider: null, merchantId: null, hasSecret: false, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: false, simulator: false },
  posConfig: { provider: null, baseUrl: null, hasApiKey: false, tableMapping: {}, sendOrdersToPos: false, closeOnPayment: true, printOnClose: false, closeMode: 'reuse-external-id', simulator: false },
  orderingMode: 'off',
  orderingPaused: false,
  pausedMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-20T09:12:00.000Z',
};

export const membership: MembershipDto = {
  id: ids.membership,
  role: 'owner',
  restaurant: {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: restaurant.city,
    logoUrl: null,
    primaryColor: restaurant.primaryColor,
    status: 'active',
    plan: 'pro',
    publishedAt: restaurant.publishedAt,
  },
};

export function sessionFor(who: UserDto, accessToken = 'token-1'): AuthResponseDto {
  return { accessToken, expiresIn: 900, user: who, memberships: [membership] };
}

const stamps = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-10-20T09:12:00.000Z' };

export const categories: CategoryDto[] = [
  { id: ids.coffee, restaurantId: ids.restaurant, name: { sr: 'Kafa', en: 'Coffee' }, sortOrder: 0, isHidden: false, itemCount: 2, ...stamps },
  { id: ids.breakfast, restaurantId: ids.restaurant, name: { sr: 'Doručak', en: 'Breakfast' }, sortOrder: 1, isHidden: false, itemCount: 1, ...stamps },
  { id: ids.seasonal, restaurantId: ids.restaurant, name: { sr: 'Sezonsko', en: 'Seasonal' }, sortOrder: 2, isHidden: true, itemCount: 0, ...stamps },
];

export const items: MenuItemDto[] = [
  {
    id: ids.espresso,
    restaurantId: ids.restaurant,
    categoryId: ids.coffee,
    name: { sr: 'Espresso', en: 'Espresso' },
    description: { sr: 'Zrna iz Etiopije', en: 'Ethiopian beans' },
    priceCents: 18000,
    imageUrl: null,
    thumbnailUrl: null,
    posProductCode: null,
    allergens: [],
    tags: [],
    isAvailable: true,
    unavailableUntil: null,
    isEffectivelyAvailable: true,
    sortOrder: 0,
    variants: [],
    ...stamps,
  },
  {
    id: ids.cappuccino,
    restaurantId: ids.restaurant,
    categoryId: ids.coffee,
    name: { sr: 'Kapućino', en: 'Cappuccino' },
    description: null,
    priceCents: 25000,
    imageUrl: null,
    thumbnailUrl: null,
    posProductCode: null,
    allergens: ['M'],
    tags: ['new'],
    isAvailable: true,
    unavailableUntil: null,
    isEffectivelyAvailable: true,
    sortOrder: 1,
    variants: [],
    ...stamps,
  },
  {
    id: ids.avocado,
    restaurantId: ids.restaurant,
    categoryId: ids.breakfast,
    name: { sr: 'Tost sa avokadom', en: 'Avocado toast' },
    description: null,
    priceCents: 65000,
    imageUrl: null,
    thumbnailUrl: null,
    posProductCode: null,
    allergens: ['G', 'Se'],
    tags: ['vegan'],
    isAvailable: false,
    unavailableUntil: null,
    isEffectivelyAvailable: false,
    sortOrder: 0,
    variants: [],
    ...stamps,
  },
];

export const tables: TableDto[] = [
  {
    id: ids.table7,
    restaurantId: ids.restaurant,
    number: 7,
    label: 'Table 7',
    sortOrder: 7,
    menuUrl: 'http://kafeterija.localhost:5174/t/7',
    scansLast7Days: 63,
    lastScanAt: '2026-10-20T09:00:00.000Z',
    blockedUntil: null,
    createdAt: stamps.createdAt,
  },
];

export const analytics: AnalyticsDto = {
  range: '7d',
  timezone: 'Europe/Belgrade',
  period: { from: '2026-10-14', to: '2026-10-20' },
  previousPeriod: { from: '2026-10-07', to: '2026-10-13' },
  totalScans: { value: 120, previous: 100, deltaPct: 20 },
  avgPerDay: { value: 17.1, previous: 14.3, deltaPct: 20 },
  itemsViewedPerScan: { value: 3.4, previous: 3.6, deltaPct: -5.5 },
  scansPerDay: ['14', '15', '16', '17', '18', '19', '20'].map((d, i) => ({ date: `2026-10-${d}`, scans: 10 + i * 3 })),
  topItems: [{ itemId: ids.espresso, name: { sr: 'Espresso' }, views: 41, previousViews: 30, deltaPct: 37 }],
  scansByTable: [{ tableId: ids.table7, number: 7, label: 'Table 7', scans: 63, previousScans: 50, deltaPct: 26 }],
  ordering: {
    orders: { value: 212, previous: 180, deltaPct: 17.8 },
    acceptedRate: { value: 94, previous: 91, deltaPct: 3.3 },
    medianAcceptSeconds: 100,
    previousMedianAcceptSeconds: 120,
    orderedRevenueCents: { value: 23845000, previous: 20100000, deltaPct: 18.6 },
    paidOnlineCount: { value: 40, previous: 31, deltaPct: 29 },
    paidOnlineCents: { value: 4120000, previous: 3300000, deltaPct: 24.8 },
    tipsCents: { value: 312000, previous: 250000, deltaPct: 24.8 },
  },
};

/** The same venue with table ordering switched on. */
export const restaurantOrdering: RestaurantDto = { ...restaurant, modules: { ...restaurant.modules, ordering: true }, orderingMode: 'order' };

const orderStamps = { createdAt: '2026-10-22T11:42:00.000Z', updatedAt: '2026-10-22T11:42:00.000Z' };
export const orders: OrderDto[] = [
  {
    id: ids.order142,
    restaurantId: ids.restaurant,
    number: 142,
    status: 'new',
    tableId: ids.table7,
    tableNumber: 7,
    guestName: 'Marko',
    note: 'Sve odjednom, molim.',
    totalCents: 171000,
    locale: 'sr',
    rejectedReason: null,
    items: [
      { id: 'l1', menuItemId: ids.espresso, variantId: null, name: { sr: 'Flat white' }, variantName: 'Large 300 ml', unitPriceCents: 34000, quantity: 2, lineTotalCents: 68000, lineNote: null },
      { id: 'l2', menuItemId: ids.cappuccino, variantId: null, name: { sr: 'Šakšuka', en: 'Shakshuka' }, variantName: null, unitPriceCents: 79000, quantity: 1, lineTotalCents: 79000, lineNote: 'bez čilija' },
      { id: 'l3', menuItemId: ids.espresso, variantId: null, name: { sr: 'Cortado' }, variantName: null, unitPriceCents: 24000, quantity: 1, lineTotalCents: 24000, lineNote: null },
    ],
    ...orderStamps,
    acceptedAt: null,
    deliveredAt: null,
    closedAt: null,
    expiresAt: '2026-10-22T12:02:00.000Z',
    paymentStatus: 'unpaid',
    tipCents: 0,
    paidAmountCents: null,
    paidAt: null,
    providerRef: null,
    fiscalStatus: 'none',
    fiscalInvoiceNumber: null,
    fiscalVerificationUrl: null,
    fiscalError: null,
    posRef: null,
  },
  {
    id: ids.order143,
    restaurantId: ids.restaurant,
    number: 143,
    status: 'new',
    tableId: null,
    tableNumber: 2,
    guestName: null,
    note: null,
    totalCents: 76000,
    locale: 'sr',
    rejectedReason: null,
    items: [
      { id: 'l4', menuItemId: ids.espresso, variantId: null, name: { sr: 'Domaća kafa' }, variantName: null, unitPriceCents: 20000, quantity: 1, lineTotalCents: 20000, lineNote: null },
      { id: 'l5', menuItemId: ids.cappuccino, variantId: null, name: { sr: 'Cardamom bun' }, variantName: null, unitPriceCents: 28000, quantity: 2, lineTotalCents: 56000, lineNote: null },
    ],
    createdAt: '2026-10-22T11:35:00.000Z',
    updatedAt: '2026-10-22T11:35:00.000Z',
    acceptedAt: null,
    deliveredAt: null,
    closedAt: null,
    expiresAt: '2026-10-22T11:55:00.000Z',
    paymentStatus: 'unpaid',
    tipCents: 0,
    paidAmountCents: null,
    paidAt: null,
    providerRef: null,
    fiscalStatus: 'none',
    fiscalInvoiceNumber: null,
    fiscalVerificationUrl: null,
    fiscalError: null,
    posRef: null,
  },
  {
    id: ids.order141,
    restaurantId: ids.restaurant,
    number: 141,
    status: 'accepted',
    tableId: null,
    tableNumber: 11,
    guestName: 'Jelena',
    note: null,
    totalCents: 104000,
    locale: 'sr',
    rejectedReason: null,
    items: [
      { id: 'l6', menuItemId: ids.cappuccino, variantId: null, name: { sr: 'Granola bowl' }, variantName: 'Large', unitPriceCents: 72000, quantity: 1, lineTotalCents: 72000, lineNote: null },
      { id: 'l7', menuItemId: ids.espresso, variantId: null, name: { sr: 'Filter, Ethiopia Guji' }, variantName: 'Cup 250 ml', unitPriceCents: 32000, quantity: 1, lineTotalCents: 32000, lineNote: null },
    ],
    createdAt: '2026-10-22T11:30:00.000Z',
    updatedAt: '2026-10-22T11:31:00.000Z',
    acceptedAt: '2026-10-22T11:31:00.000Z',
    deliveredAt: null,
    closedAt: null,
    expiresAt: null,
    paymentStatus: 'unpaid',
    tipCents: 0,
    paidAmountCents: null,
    paidAt: null,
    providerRef: null,
    fiscalStatus: 'none',
    fiscalInvoiceNumber: null,
    fiscalVerificationUrl: null,
    fiscalError: null,
    posRef: null,
  },
  {
    id: ids.order140,
    restaurantId: ids.restaurant,
    number: 140,
    status: 'delivered',
    tableId: null,
    tableNumber: 5,
    guestName: null,
    note: null,
    totalCents: 103000,
    locale: 'sr',
    rejectedReason: null,
    items: [{ id: 'l8', menuItemId: ids.espresso, variantId: null, name: { sr: 'Espresso' }, variantName: null, unitPriceCents: 103000, quantity: 1, lineTotalCents: 103000, lineNote: null }],
    createdAt: '2026-10-22T10:50:00.000Z',
    updatedAt: '2026-10-22T11:02:00.000Z',
    acceptedAt: '2026-10-22T10:52:00.000Z',
    deliveredAt: '2026-10-22T11:02:00.000Z',
    closedAt: '2026-10-22T11:02:00.000Z',
    expiresAt: null,
    paymentStatus: 'unpaid',
    tipCents: 0,
    paidAmountCents: null,
    paidAt: null,
    providerRef: null,
    fiscalStatus: 'none',
    fiscalInvoiceNumber: null,
    fiscalVerificationUrl: null,
    fiscalError: null,
    posRef: null,
  },
];

export const serviceRequests: ServiceRequestDto[] = [
  { id: ids.call4, restaurantId: ids.restaurant, tableId: ids.table7, tableNumber: 4, type: 'call_waiter', status: 'open', createdAt: '2026-10-22T11:43:00.000Z', updatedAt: '2026-10-22T11:43:00.000Z', doneAt: null },
  { id: ids.bill8, restaurantId: ids.restaurant, tableId: ids.table7, tableNumber: 8, type: 'bill', status: 'done', createdAt: '2026-10-22T11:20:00.000Z', updatedAt: '2026-10-22T11:25:00.000Z', doneAt: '2026-10-22T11:25:00.000Z' },
];

/** Override that answers GET /restaurant with the ordering module on and the given mode (everything else falls through). */
export function orderingMode(mode: OrderingMode): FetchHandler {
  return ({ url, method }) =>
    url.pathname === `/api/admin/restaurants/${ids.restaurant}` && method === 'GET'
      ? { body: { ...restaurant, modules: { ...restaurant.modules, ordering: true }, orderingMode: mode } }
      : undefined;
}

/**
 * Override with an in-memory copy of the orders and requests, so refetches (after the stream opens, on focus…) do not
 * undo what a test pushed through the stream. Mutations still come from `defaultApi`.
 */
export function liveOrdering(mode: OrderingMode = 'order'): { handler: FetchHandler; orders: OrderDto[]; requests: ServiceRequestDto[] } {
  const live = { orders: orders.map((o) => ({ ...o })), requests: serviceRequests.map((r) => ({ ...r })) };
  const base = `/api/admin/restaurants/${ids.restaurant}`;
  const handler: FetchHandler = ({ url, method }) => {
    if (url.pathname === base && method === 'GET') return { body: { ...restaurant, modules: { ...restaurant.modules, ordering: true }, orderingMode: mode } };
    if (url.pathname === `${base}/orders` && method === 'GET') return { body: live.orders };
    if (url.pathname === `${base}/requests` && method === 'GET') return { body: live.requests };
    return undefined;
  };
  return { handler, orders: live.orders, requests: live.requests };
}

/** EventSource stand-in for the waiter screen's live stream; tests open it and push events by hand. */
export class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly url: string;
  readyState = 0;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }
  private dispatch(type: string, event: Event): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
  /** The server accepted the stream. */
  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.dispatch('open', new Event('open'));
  }
  emit(event: OrderingEvent): void {
    this.dispatch(event.type, new MessageEvent(event.type, { data: JSON.stringify(event) }));
  }
  fail(): void {
    this.dispatch('error', new Event('error'));
  }
}

export const superadminRows: SuperadminRestaurantDto[] = [
  {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: 'Beograd',
    logoUrl: null,
    primaryColor: restaurant.primaryColor,
    status: 'active',
    plan: 'pro',
    trialEndsAt: null,
    publishedAt: restaurant.publishedAt,
    tableCount: 1,
    itemCount: 3,
    modules: { ordering: true, payments: false, pos: false },
    owner: { id: user.id, name: user.name, email: user.email },
    ...stamps,
  },
];

/* ------------------------------------------------------------------ fetch mock */

export interface MockRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
  /** 1-based count of requests to this exact method+path so far. */
  nth: number;
}
export type FetchReply = { status?: number; body?: unknown } | Response | Error;
export type FetchHandler = (request: MockRequest) => FetchReply | undefined | Promise<FetchReply | undefined>;

function toResponse(reply: Exclude<FetchReply, Error>): Response {
  if (reply instanceof Response) return reply;
  const status = reply.status ?? 200;
  if (status === 204 || reply.body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(reply.body), { status, headers: { 'Content-Type': 'application/json' } });
}

export interface ApiState {
  session: AuthResponseDto;
  /** false → POST /api/auth/refresh answers 401. */
  refreshOk?: boolean;
}

/** Baseline API behaviour for the fixtures above; `override` may answer first and return undefined to fall through. */
export function mockApi(state: ApiState, override?: FetchHandler) {
  const counts = new Map<string, number>();
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = `${method} ${url.pathname}`;
    const nth = (counts.get(key) ?? 0) + 1;
    counts.set(key, nth);
    const rawBody = init?.body;
    const body = typeof rawBody === 'string' ? (JSON.parse(rawBody) as unknown) : rawBody;
    const request: MockRequest = { url, method, headers: new Headers(init?.headers), body, nth };

    const custom = await override?.(request);
    const reply = custom ?? (await defaultApi(state, request));
    if (reply instanceof Error) throw reply;
    return toResponse(reply);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

function defaultApi(state: ApiState, { url, method, body }: MockRequest): FetchReply {
  const path = url.pathname;
  const base = `/api/admin/restaurants/${ids.restaurant}`;
  const me: MeDto = { user: state.session.user, memberships: state.session.memberships };

  if (path === '/api/auth/refresh' && method === 'POST') {
    return state.refreshOk === false
      ? { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Missing refresh token' } } }
      : { body: state.session };
  }
  if (path === '/api/auth/login' && method === 'POST') {
    const input = body as { email?: string; password?: string };
    return input.email === state.session.user.email && input.password === 'tabla1234'
      ? { body: state.session }
      : { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } } };
  }
  if (path === '/api/auth/logout') return { body: { ok: true } };
  if (path === '/api/auth/me') return { body: me };
  if (path === base && method === 'GET') return { body: restaurant };
  if (path === base && method === 'PATCH') return { body: { ...restaurant, ...(body as Partial<RestaurantDto>) } };
  if (path === `${base}/categories` && method === 'GET') return { body: categories };
  if (path === `${base}/items` && method === 'GET') return { body: items };
  if (path === `${base}/items` && method === 'POST') {
    const input = body as Partial<MenuItemDto>;
    return { status: 201, body: { ...items[0]!, ...input, id: '12121212-1212-4121-8121-121212121212' } };
  }
  const availability = new RegExp(`^${base}/items/([^/]+)/availability$`).exec(path);
  if (availability && method === 'PATCH') {
    const item = items.find((i) => i.id === availability[1]);
    if (!item) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Menu item not found' } } };
    const input = body as { available: boolean; until?: string };
    return {
      body: {
        ...item,
        isAvailable: input.available || Boolean(input.until),
        unavailableUntil: input.until ? '2026-10-21T04:00:00.000Z' : null,
        isEffectivelyAvailable: input.available,
      },
    };
  }
  if (path === `${base}/tables`) return { body: tables };
  const block = new RegExp(`^${base}/tables/([^/]+)/block$`).exec(path);
  if (block && (method === 'POST' || method === 'DELETE')) {
    const table = tables.find((t) => t.id === block[1]);
    if (!table) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Table not found' } } };
    return { body: { ...table, blockedUntil: method === 'POST' ? new Date(Date.now() + 30 * 60_000).toISOString() : null } };
  }
  if (path === `${base}/analytics`) return { body: analytics };
  if (path === `${base}/orders` && method === 'GET') return { body: orders };
  if (path === `${base}/requests` && method === 'GET') return { body: serviceRequests };
  if (path === `${base}/sse-token` && method === 'POST') return { body: { token: 'sse-token', expiresIn: 300 } };
  const cashPatch = new RegExp(`^${base}/orders/([^/]+)/payment$`).exec(path);
  if (cashPatch && method === 'PATCH') {
    const order = orders.find((o) => o.id === cashPatch[1]);
    if (!order) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Order not found' } } };
    return { body: { ...order, paymentStatus: 'cash', paidAmountCents: order.totalCents, paidAt: '2026-10-22T11:50:00.000Z', updatedAt: '2026-10-22T11:50:00.000Z' } };
  }
  if (path === `${base}/payment-config`) {
    if (method === 'GET') return { body: restaurant.paymentConfig };
    if (method === 'PATCH') {
      const patch = body as { secret?: string } & Partial<typeof restaurant.paymentConfig>;
      const { secret, ...rest } = patch;
      return { body: { ...restaurant.paymentConfig, ...rest, hasSecret: restaurant.paymentConfig.hasSecret || Boolean(secret), simulator: rest.provider === 'mock' } };
    }
  }
  if (path === `${base}/payment-config/test` && method === 'POST') return { body: { ok: true, message: 'Simulator ready' } };
  if (path === `${base}/pos-config`) {
    if (method === 'GET') return { body: restaurant.posConfig };
    if (method === 'PATCH') {
      const { apiKey, ...rest } = body as { apiKey?: string } & Partial<typeof restaurant.posConfig>;
      return { body: { ...restaurant.posConfig, ...rest, hasApiKey: restaurant.posConfig.hasApiKey || Boolean(apiKey), simulator: rest.provider === 'mock' } };
    }
  }
  if (path === `${base}/pos-config/test` && method === 'POST') return { body: { ok: true, message: 'Mock register ready — 4 products' } };
  if (path === `${base}/pos/products` && method === 'GET') {
    return {
      body: {
        fetchedAt: '2026-10-22T12:00:00.000Z',
        create: [{ code: 'CAP', name: 'Kapućino', group: 'Kafa', priceCents: 25000, taxLabel: '20%', active: true }],
        update: [{ itemId: ids.espresso, code: 'ESP', name: 'Espresso', currentPriceCents: 18000, priceCents: 19000 }],
        missing: [],
        unmapped: 2,
      },
    };
  }
  if (path === `${base}/pos/sync` && method === 'POST') {
    const input = body as { createCodes: string[]; updateCodes: string[] };
    return { body: { created: input.createCodes.length, updated: input.updateCodes.length, categoryId: ids.coffee } };
  }
  const fiscalManual = new RegExp(`^${base}/orders/([^/]+)/fiscal/manual$`).exec(path);
  if (fiscalManual && method === 'POST') {
    const order = orders.find((o) => o.id === fiscalManual[1]);
    if (!order) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Order not found' } } };
    return { body: { ...order, fiscalStatus: 'manual', fiscalError: null, updatedAt: '2026-10-22T11:52:00.000Z' } };
  }
  const fiscalRetry = new RegExp(`^${base}/orders/([^/]+)/fiscal/retry$`).exec(path);
  if (fiscalRetry && method === 'POST') {
    const order = orders.find((o) => o.id === fiscalRetry[1]);
    if (!order) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Order not found' } } };
    return { body: { ...order, fiscalStatus: 'pending', fiscalError: null, updatedAt: '2026-10-22T11:51:00.000Z' } };
  }
  const orderPatch = new RegExp(`^${base}/orders/([^/]+)$`).exec(path);
  if (orderPatch && method === 'PATCH') {
    const order = orders.find((o) => o.id === orderPatch[1]);
    if (!order) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Order not found' } } };
    const input = body as UpdateOrderStatusInput;
    const at = '2026-10-22T11:50:00.000Z';
    return {
      body: {
        ...order,
        status: input.status,
        rejectedReason: input.rejectedReason ?? null,
        acceptedAt: input.status === 'accepted' ? at : order.acceptedAt,
        deliveredAt: input.status === 'delivered' ? at : null,
        closedAt: input.status === 'accepted' ? null : at,
        expiresAt: null,
        updatedAt: at,
      },
    };
  }
  const requestPatch = new RegExp(`^${base}/requests/([^/]+)$`).exec(path);
  if (requestPatch && method === 'PATCH') {
    const request = serviceRequests.find((r) => r.id === requestPatch[1]);
    if (!request) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Request not found' } } };
    return { body: { ...request, status: 'done', doneAt: '2026-10-22T11:50:00.000Z', updatedAt: '2026-10-22T11:50:00.000Z' } };
  }
  if (path === '/api/superadmin/restaurants') return { body: { items: superadminRows, total: superadminRows.length, page: 1, pageSize: 50 } };
  if (path.endsWith('/qr.svg')) return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': 'image/svg+xml' } });
  return { status: 404, body: { error: { code: 'NOT_FOUND', message: `No mock for ${method} ${path}` } } };
}

/**
 * Override that remembers availability changes, so the refetch after a PATCH reflects the new state
 * (the static fixtures would otherwise "undo" the change).
 */
export function statefulItems(): FetchHandler {
  const current = new Map(items.map((item) => [item.id, { ...item }]));
  return ({ url, method, body }) => {
    const base = `/api/admin/restaurants/${ids.restaurant}`;
    if (url.pathname === `${base}/items` && method === 'GET') return { body: [...current.values()] };
    const match = new RegExp(`^${base}/items/([^/]+)/availability$`).exec(url.pathname);
    if (match && method === 'PATCH') {
      const item = current.get(match[1]!);
      if (!item) return undefined;
      const input = body as { available: boolean; until?: string };
      const next = {
        ...item,
        isAvailable: input.available || Boolean(input.until),
        unavailableUntil: input.until ? '2026-10-21T04:00:00.000Z' : null,
        isEffectivelyAvailable: input.available,
      };
      current.set(item.id, next);
      return { body: next };
    }
    return undefined;
  };
}

export function requests(spy: ReturnType<typeof mockApi>) {
  return spy.mock.calls.map(([input, init]) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const rawBody = init?.body;
    return {
      url: new URL(href, 'http://localhost'),
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: new Headers(init?.headers),
      body: typeof rawBody === 'string' ? (JSON.parse(rawBody) as Record<string, unknown>) : undefined,
    };
  });
}

/* ------------------------------------------------------------------ render */

interface RenderOptions {
  viewport?: Viewport;
  /** true → an open-tab session flag is set so the app restores the session through POST /api/auth/refresh. */
  authenticated?: boolean;
}

export function renderApp(route: string, { viewport: frame = 'desktop', authenticated = true }: RenderOptions = {}) {
  setViewport(frame);
  if (authenticated) sessionStorage.setItem('tabla.cms.session', '1');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, client };
}
