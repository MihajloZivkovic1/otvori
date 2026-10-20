import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import type { PublicMenuDto } from '@qr-menu/shared';
import { App } from '../src/App';

/** IntersectionObserver stand-in: tests drive it with `trigger()`. */
export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly elements = new Set<Element>();
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: number[] = [0];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? '0px';
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.elements.add(element);
  }
  unobserve(element: Element): void {
    this.elements.delete(element);
  }
  disconnect(): void {
    this.elements.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(entries: { target: Element; isIntersecting: boolean }[]): void {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

export const ids = {
  coffee: '11111111-1111-4111-8111-111111111111',
  breakfast: '22222222-2222-4222-8222-222222222222',
  espresso: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  espressoSingle: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  espressoDouble: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  cappuccino: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  avocado: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};

export const menuSr: PublicMenuDto = {
  restaurant: {
    slug: 'kafeterija',
    name: 'Kafeterija Dorćol',
    tagline: 'Specialty coffee & breakfast',
    menuNote: 'Kuhinja do 16:00',
    logoUrl: null,
    primaryColor: '#7A3E48',
    theme: 'light',
    currency: 'RSD',
    defaultLocale: 'sr',
    supportedLocales: ['sr', 'en'],
    address: 'Cara Dušana 12',
    city: 'Beograd',
  },
  locale: 'sr',
  categories: [
    {
      id: ids.coffee,
      name: 'Kafa',
      items: [
        {
          id: ids.espresso,
          name: 'Espresso',
          description: 'Zrna iz Etiopije, srednje prženje',
          priceCents: 18000,
          imageUrl: null,
          allergens: [],
          tags: [],
          isAvailable: true,
          variants: [
            { id: ids.espressoSingle, name: 'Single', priceCents: 18000 },
            { id: ids.espressoDouble, name: 'Double', priceCents: 22000 },
          ],
        },
        {
          id: ids.cappuccino,
          name: 'Kapućino',
          description: null,
          priceCents: 25000,
          imageUrl: 'https://img.test/kapucino.webp',
          allergens: ['M'],
          tags: ['new'],
          isAvailable: true,
          variants: [],
        },
      ],
    },
    {
      id: ids.breakfast,
      name: 'Doručak',
      items: [
        {
          id: ids.avocado,
          name: 'Tost sa avokadom',
          description: 'Kiselo testo, avokado, čeri paradajz, susam',
          priceCents: 65000,
          imageUrl: null,
          allergens: ['G', 'Se'],
          tags: ['vegan'],
          isAvailable: false,
          variants: [],
        },
      ],
    },
  ],
  updatedAt: '2026-10-20T10:00:00.000Z',
};

export const menuEn: PublicMenuDto = {
  ...menuSr,
  restaurant: { ...menuSr.restaurant, menuNote: 'Kitchen until 16:00' },
  locale: 'en',
  categories: [
    {
      ...menuSr.categories[0]!,
      name: 'Coffee',
      items: [
        { ...menuSr.categories[0]!.items[0]!, description: 'Ethiopian beans, medium roast' },
        { ...menuSr.categories[0]!.items[1]!, name: 'Cappuccino' },
      ],
    },
    {
      ...menuSr.categories[1]!,
      name: 'Breakfast',
      items: [
        {
          ...menuSr.categories[1]!.items[0]!,
          name: 'Avocado toast',
          description: 'Sourdough, avocado, cherry tomatoes, sesame',
        },
      ],
    },
  ],
};

export type FetchReply = { status?: number; body: unknown } | Error;
export type FetchHandler = (url: URL, init: RequestInit | undefined) => FetchReply | Promise<FetchReply>;

/** Replaces global fetch; the handler decides per URL. Returns the spy for call inspection. */
export function mockFetch(handler: FetchHandler) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const reply = await handler(new URL(href, 'http://localhost'), init);
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: async () => reply.body,
    } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

export function requests(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls.map(([input, init]) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return { url: new URL(href, 'http://localhost'), init };
  });
}

export function menuRequests(spy: ReturnType<typeof mockFetch>) {
  return requests(spy).filter(({ url }) => url.pathname.endsWith('/menu'));
}

export function eventBodies(spy: ReturnType<typeof mockFetch>): Record<string, unknown>[] {
  return requests(spy)
    .filter(({ url }) => url.pathname.endsWith('/events'))
    .map(({ init }) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

/** Serves the SR/EN fixtures by `locale` query and accepts events. */
export const serveFixtures: FetchHandler = (url) => {
  if (url.pathname.endsWith('/events')) return { status: 202, body: { ok: true } };
  return { body: url.searchParams.get('locale') === 'en' ? menuEn : menuSr };
};

export function renderMenu(route = '/r/kafeterija/t/7') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
