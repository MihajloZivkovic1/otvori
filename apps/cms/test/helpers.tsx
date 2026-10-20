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
  RestaurantDto,
  SuperadminRestaurantDto,
  TableDto,
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

export const superadmin: UserDto = { ...user, id: ids.admin, email: 'admin@tabla.rs', name: 'Tabla Admin', isSuperadmin: true };

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
    menuUrl: 'http://kafeterija.localhost:5174/?t=7',
    scansLast7Days: 63,
    lastScanAt: '2026-10-20T09:00:00.000Z',
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
};

export const superadminRows: SuperadminRestaurantDto[] = [
  {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: 'Beograd',
    status: 'active',
    plan: 'pro',
    trialEndsAt: null,
    publishedAt: restaurant.publishedAt,
    tableCount: 1,
    itemCount: 3,
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
  if (path === `${base}/analytics`) return { body: analytics };
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
