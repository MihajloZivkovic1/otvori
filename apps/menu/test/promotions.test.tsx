import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PublicPromotionDto } from '@qr-menu/shared';
import { ids, menuEn, menuOrdering, menuSr, mockFetch, renderMenu, requests, type FetchHandler } from './helpers';

const cocktail: PublicPromotionDto = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  title: 'Cocktail Menu',
  template: 'drink_list',
  display: 'banner',
  accentColor: '#E8453C',
  style: null,
  priority: 10,
  imageUrl: null,
  updatedAt: '2026-10-29T10:00:00.000Z',
  items: [],
  content: {
    logoText: 'Kafeterija Dorćol',
    columns: 2,
    entries: [
      { name: 'Negroni', lines: ['Beefeater gin', 'Campari liker', 'Martini Rosso vermut'] },
      { name: 'Hugo', lines: ['Penušavo vino', 'Sirup od zove'] },
      { name: 'Pink Panther', lines: ['Olmeca tequila', 'Sok od ananasa'] },
    ],
  },
};

const notice: PublicPromotionDto = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  title: 'Radno vreme',
  template: 'notice',
  display: 'modal',
  accentColor: null,
  style: null,
  priority: 1,
  imageUrl: null,
  updatedAt: '2026-10-29T10:00:00.000Z',
  items: [],
  content: { headline: 'Ponedeljkom ne radimo', body: 'Vidimo se u utorak.' },
};

const featured: PublicPromotionDto = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  title: 'Probaj ove nedelje',
  template: 'featured_items',
  display: 'card',
  accentColor: null,
  style: null,
  priority: 0,
  imageUrl: null,
  updatedAt: '2026-10-29T10:00:00.000Z',
  items: [
    { id: ids.cappuccino, name: 'Kapućino', description: null, priceCents: 25000, imageUrl: 'https://img.test/kapucino.webp', thumbnailUrl: null, isAvailable: true },
  ],
  content: { intro: 'Barista bira.', items: [{ menuItemId: ids.cappuccino, badge: 'Novo' }] },
};

function serve(promotions: PublicPromotionDto[], ordering = false): FetchHandler {
  return (url) => {
    if (url.pathname.endsWith('/events')) return { status: 202, body: { ok: true } };
    if (url.pathname.endsWith('/promotions')) return { body: promotions };
    const menu = url.searchParams.get('locale') === 'en' ? menuEn : menuSr;
    return { body: ordering ? { ...menu, restaurant: menuOrdering.restaurant } : menu };
  };
}

describe('promotions on the guest menu', () => {
  it('fetches promotions next to the menu and shows the banner with the title and “Pogledaj”', async () => {
    const spy = mockFetch(serve([cocktail]));
    renderMenu();
    const banner = await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' });
    expect(within(banner).getByText('Cocktail Menu')).toBeInTheDocument();
    expect(within(banner).getByText('Pogledaj')).toBeInTheDocument();
    expect(within(banner).getByText('Negroni · Hugo · Pink Panther')).toBeInTheDocument();
    const promoCalls = requests(spy).filter(({ url }) => url.pathname.endsWith('/promotions'));
    expect(promoCalls).toHaveLength(1);
    expect(promoCalls[0]!.url.pathname).toBe('/api/public/kafeterija/promotions');
  });

  it('opens the full cocktail list from the banner and closes it with Escape', async () => {
    mockFetch(serve([cocktail]));
    renderMenu();
    const user = userEvent.setup();
    const banner = await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' });
    await user.click(within(banner).getByText('Pogledaj'));

    const dialog = await screen.findByRole('dialog', { name: 'Cocktail Menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const card = await within(dialog).findByRole('article', { name: 'Cocktail Menu' });
    expect(within(card).getByText('Negroni')).toBeInTheDocument();
    expect(within(card).getByText('Martini Rosso vermut')).toBeInTheDocument();
    expect(within(card).getByText('Kafeterija Dorćol')).toBeInTheDocument();
    // Two columns: the second one is right-aligned; the accent travels as a CSS variable.
    const columns = card.querySelectorAll('.promo-dl-col');
    expect(columns).toHaveLength(2);
    expect(columns[1]).toHaveClass('is-right');
    expect(within(columns[1] as HTMLElement).getByText('Pink Panther')).toBeInTheDocument();
    expect((card.closest('.promo-root') as HTMLElement).style.getPropertyValue('--promo-accent')).toBe('#E8453C');
    // Body scroll is locked while open; the banner is hidden behind the modal.
    expect(document.body.style.position).toBe('fixed');
    expect(screen.queryByRole('region', { name: 'Promocija: Cocktail Menu' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.position).toBe('');
    expect(await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' })).toBeInTheDocument();
  });

  it('closes on a one-finger swipe down, but not on a pinch, a sideways pan or while the page is zoomed in', async () => {
    mockFetch(serve([cocktail]));
    renderMenu();
    const user = userEvent.setup();
    await user.click(within(await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' })).getByText('Pogledaj'));
    const dialog = await screen.findByRole('dialog', { name: 'Cocktail Menu' });
    const point = (clientX: number, clientY: number) => ({ clientX, clientY });
    const drag = (from: { clientX: number; clientY: number }, to: { clientX: number; clientY: number }) => {
      fireEvent.touchStart(dialog, { touches: [from] });
      fireEvent.touchEnd(dialog, { touches: [], changedTouches: [to] });
    };

    // Pinch: a second finger joins, then both lift well below where the first one started.
    fireEvent.touchStart(dialog, { touches: [point(150, 100)] });
    fireEvent.touchStart(dialog, { touches: [point(150, 100), point(200, 300)] });
    fireEvent.touchEnd(dialog, { touches: [point(150, 260)], changedTouches: [point(240, 420)] });
    fireEvent.touchEnd(dialog, { touches: [], changedTouches: [point(150, 260)] });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Zoomed in, a one-finger drag pans the zoomed page instead.
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { scale: 2 } });
    try {
      drag(point(150, 100), point(150, 300));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }

    // A diagonal pan is not a close either.
    drag(point(100, 100), point(300, 190));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    drag(point(150, 100), point(158, 200));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('collapses the banner to a pill that opens the promotion directly, and stays collapsed for the tab', async () => {
    mockFetch(serve([cocktail]));
    renderMenu();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' });
    await user.click(screen.getByRole('button', { name: 'Sakrij promociju' }));
    expect(screen.queryByRole('region', { name: 'Promocija: Cocktail Menu' })).not.toBeInTheDocument();
    const pill = screen.getByRole('button', { name: 'Prikaži promociju: Cocktail Menu' });
    expect(sessionStorage.getItem(`tabla.promo.collapsed.${cocktail.id}`)).toBe('1');
    await user.click(pill);
    // One tap opens the full view; closing it brings the pill back, not the bar.
    expect(await screen.findByRole('dialog', { name: 'Cocktail Menu' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Promocija: Cocktail Menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prikaži promociju: Cocktail Menu' })).toBeInTheDocument();
    expect(sessionStorage.getItem(`tabla.promo.collapsed.${cocktail.id}`)).toBe('1');
  });

  it('shows the modal ~600 ms after the menu, closes on the backdrop and stays dismissed for 24 h', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockFetch(serve([notice]));
      renderMenu();
      await screen.findByRole('heading', { name: 'Kafa' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
      });
      const dialog = await screen.findByRole('dialog', { name: 'Radno vreme' });
      expect(await within(dialog).findByText('Ponedeljkom ne radimo')).toBeInTheDocument();
      expect(within(dialog).getByText('Vidimo se u utorak.')).toBeInTheDocument();
      expect(within(dialog).getByText('Obaveštenje')).toBeInTheDocument();

      // Tap outside closes and records the dismissal keyed by id + updatedAt.
      const scrim = document.querySelector('[data-testid="promotion-modal"] > [aria-hidden="true"]') as HTMLElement;
      await act(async () => {
        scrim.click();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const stored = JSON.parse(localStorage.getItem('tabla.promo.dismissed') ?? '{}') as Record<string, number>;
      expect(Object.keys(stored)).toEqual([`${notice.id}:${notice.updatedAt}`]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not show a dismissed modal again, but does after the owner edited it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      localStorage.setItem('tabla.promo.dismissed', JSON.stringify({ [`${notice.id}:${notice.updatedAt}`]: Date.now() - 60_000 }));
      mockFetch(serve([notice]));
      const first = renderMenu();
      await screen.findByRole('heading', { name: 'Kafa' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      first.unmount();

      mockFetch(serve([{ ...notice, updatedAt: '2026-10-29T12:00:00.000Z' }]));
      renderMenu();
      await screen.findByRole('heading', { name: 'Kafa' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(await screen.findByRole('dialog', { name: 'Radno vreme' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the inline card above the first category and opens the featured items with live prices', async () => {
    mockFetch(serve([featured]));
    renderMenu();
    const user = userEvent.setup();
    const card = await screen.findByRole('button', { name: 'Promocija: Probaj ove nedelje' });
    const main = screen.getByRole('main');
    // The card is the first thing in <main>, before the "Kafa" section.
    expect(main.firstElementChild).toContainElement(card);
    expect(within(card).getByText('Barista bira.')).toBeInTheDocument();
    await user.click(card);
    const dialog = await screen.findByRole('dialog', { name: 'Probaj ove nedelje' });
    expect(await within(dialog).findByText('Kapućino')).toBeInTheDocument();
    expect(within(dialog).getByText('250 RSD')).toBeInTheDocument();
    expect(within(dialog).getByText('Novo')).toBeInTheDocument();
    expect(within(dialog).getByText('Preporučujemo')).toBeInTheDocument();
    // "See in menu" closes the promotion and opens the item sheet.
    await user.click(within(dialog).getByRole('button', { name: 'Vidi u meniju →' }));
    expect(await screen.findByRole('dialog', { name: 'Kapućino' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Probaj ove nedelje' })).not.toBeInTheDocument();
  });

  it('applies the style overrides: chalk variant, custom colours and the pill on the left', async () => {
    const styled: PublicPromotionDto = {
      ...cocktail,
      style: { textColor: '#FFFFFF', backgroundColor: '#1F1A17', pillPosition: 'left', pillColor: '#E8453C', pillStyle: 'outline', pillTextColor: '#123456' },
      content: { ...cocktail.content, variant: 'chalk', icons: 'none' },
    };
    mockFetch(serve([styled]));
    renderMenu();
    const user = userEvent.setup();
    const banner = await screen.findByRole('region', { name: 'Promocija: Cocktail Menu' });
    const bar = banner.firstElementChild as HTMLElement;
    expect(bar.style.background).toBe('rgb(31, 26, 23)');
    expect(bar.style.color).toBe('rgb(255, 255, 255)');
    await user.click(within(banner).getByText('Pogledaj'));
    const card = await screen.findByRole('article', { name: 'Cocktail Menu' });
    expect(card).toHaveClass('is-chalk');
    expect(card).toHaveClass('no-icons');
    expect(card.querySelector('.promo-dl-icons')).toBeNull();
    const root = card.closest('.promo-root') as HTMLElement;
    expect(root.style.getPropertyValue('--promo-text')).toBe('#FFFFFF');
    expect(root.style.getPropertyValue('--promo-bg')).toBe('#1F1A17');
    await user.keyboard('{Escape}');
    await user.click(await screen.findByRole('button', { name: 'Sakrij promociju' }));
    const pill = screen.getByRole('button', { name: 'Prikaži promociju: Cocktail Menu' });
    expect(pill.parentElement).toHaveClass('justify-start');
    expect(pill).toHaveAttribute('data-pill-style', 'outline');
    expect(pill.style.color).toBe('rgb(18, 52, 86)');
    expect(pill.style.boxShadow).toContain('#E8453C');
  });

  it('uses the English chrome with ?lang=en and shows nothing when the request fails', async () => {
    mockFetch(serve([cocktail]));
    renderMenu('/r/kafeterija/t/7?lang=en');
    const banner = await screen.findByRole('region', { name: 'Promotion: Cocktail Menu' });
    expect(within(banner).getByText('View')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide promotion' })).toBeInTheDocument();
  });

  it('keeps the menu usable when promotions cannot be loaded', async () => {
    mockFetch((url, init) => {
      if (url.pathname.endsWith('/promotions')) return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'boom' } } };
      return serve([])(url, init);
    });
    renderMenu();
    expect(await screen.findByRole('heading', { name: 'Kafa' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('region', { name: /Promocija/ })).not.toBeInTheDocument());
  });
});
