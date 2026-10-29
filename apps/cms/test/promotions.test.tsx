import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PromotionDto } from '@qr-menu/shared';
import { ids, mockApi, renderApp, requests, sessionFor, user, type FetchHandler } from './helpers';

const base = `/api/admin/restaurants/${ids.restaurant}`;
const stamps = { createdAt: '2026-10-29T10:00:00.000Z', updatedAt: '2026-10-29T10:00:00.000Z' };

const cocktail: PromotionDto = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  restaurantId: ids.restaurant,
  title: 'Cocktail Menu',
  template: 'drink_list',
  content: {
    logoText: 'Kafeterija Dorćol',
    columns: 2,
    entries: [
      { name: 'Negroni', lines: ['Beefeater gin', 'Campari liker'] },
      { name: 'Hugo', lines: ['Penušavo vino'] },
    ],
  },
  display: 'banner',
  accentColor: '#E8453C',
  priority: 10,
  isActive: true,
  startsAt: null,
  endsAt: null,
  recurrence: null,
  style: null,
  imageUrl: null,
  isActiveNow: true,
  ...stamps,
};
const scheduled: PromotionDto = {
  ...cocktail,
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  title: 'Nova bašta',
  template: 'notice',
  content: { headline: 'Bašta je otvorena', body: 'Od subote.' },
  display: 'modal',
  accentColor: null,
  priority: 0,
  startsAt: '2027-05-01T10:00:00.000Z',
  endsAt: '2027-09-30T20:00:00.000Z',
  recurrence: { weekdays: [5, 6], from: '18:00', to: '02:00' },
  isActiveNow: false,
};
const off: PromotionDto = {
  ...cocktail,
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  title: 'Happy hour',
  template: 'deal',
  content: { headline: '2 za 1', priceCents: 28000, oldPriceCents: 56000, menuItemId: ids.espresso },
  display: 'card',
  accentColor: null,
  priority: 0,
  isActive: false,
  isActiveNow: false,
};

/** A stateful stand-in for the promotion endpoints: mutations change the list the next GET returns. */
function promotionsApi(initial: PromotionDto[] = [cocktail, scheduled, off]): FetchHandler {
  let list = [...initial];
  const missing = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Promotion not found' } } };
  return ({ url, method, body }) => {
    const path = url.pathname;
    if (path === `${base}/promotions` && method === 'GET') return { body: list };
    if (path === `${base}/promotions` && method === 'POST') {
      const created = { ...cocktail, ...(body as Partial<PromotionDto>), id: '99999999-9999-4999-8999-999999999999', isActiveNow: true } as PromotionDto;
      list = [created, ...list];
      return { status: 201, body: created };
    }
    const toggle = new RegExp(`^${base}/promotions/([^/]+)/toggle$`).exec(path);
    if (toggle && method === 'PATCH') {
      const promotion = list.find((p) => p.id === toggle[1]);
      if (!promotion) return missing;
      const input = body as { isActive: boolean };
      const next = { ...promotion, isActive: input.isActive, isActiveNow: input.isActive && promotion.isActiveNow };
      list = list.map((p) => (p.id === next.id ? next : p));
      return { body: next };
    }
    const one = new RegExp(`^${base}/promotions/([^/]+)$`).exec(path);
    if (one && method === 'PATCH') {
      const promotion = list.find((p) => p.id === one[1]);
      if (!promotion) return missing;
      const next = { ...promotion, ...(body as Partial<PromotionDto>) } as PromotionDto;
      list = list.map((p) => (p.id === next.id ? next : p));
      return { body: next };
    }
    if (one && method === 'DELETE') {
      list = list.filter((p) => p.id !== one[1]);
      return { status: 204 };
    }
    return undefined;
  };
}

describe('promotions (CMS)', () => {
  it('lists promotions with template, display and the status chip, and is in the sidebar', async () => {
    mockApi({ session: sessionFor(user) }, promotionsApi());
    renderApp(`/r/${ids.restaurant}/promotions`);
    const list = await screen.findByRole('list', { name: 'Promotions' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Drink list')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Bottom banner')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Active')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Scheduled')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/1 May – 30 Sep · Fri, Sat 18:00–02:00/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Off')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Inline card')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getByRole('link', { name: 'Promotions' })).toHaveAttribute('href', `/r/${ids.restaurant}/promotions`);
  });

  it('flips the active switch through PATCH …/toggle', async () => {
    const spy = mockApi({ session: sessionFor(user) }, promotionsApi());
    renderApp(`/r/${ids.restaurant}/promotions`);
    const toggle = await screen.findByRole('switch', { name: 'Active: Cocktail Menu' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    const call = requests(spy).find(({ url, method }) => method === 'PATCH' && url.pathname.endsWith(`/promotions/${cocktail.id}/toggle`));
    expect(call?.body).toEqual({ isActive: false });
  });

  it('creates a notice through the three steps with a live preview and sends the validated payload', async () => {
    const spy = mockApi({ session: sessionFor(user) }, promotionsApi([]));
    const { router } = renderApp(`/r/${ids.restaurant}/promotions/new`);
    const u = userEvent.setup();
    const picker = await screen.findByRole('radiogroup', { name: 'Template' });
    expect(within(picker).getAllByRole('radio')).toHaveLength(4);
    await u.click(within(picker).getByRole('radio', { name: /^Notice/ }));
    await u.click(screen.getByRole('button', { name: 'Next' }));

    await u.type(screen.getByLabelText('Title'), 'Radno vreme');
    await u.type(screen.getByLabelText('Headline'), 'Ponedeljkom ne radimo');
    await u.type(screen.getByLabelText('Text'), 'Vidimo se u utorak.');
    const preview = screen.getByLabelText('Live promotion preview');
    expect(within(preview).getByRole('heading', { name: 'Ponedeljkom ne radimo' })).toBeInTheDocument();
    expect(within(preview).getByText('Vidimo se u utorak.')).toBeInTheDocument();
    expect(within(preview).getByText('Obaveštenje')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Next' }));

    await u.click(screen.getByRole('radio', { name: /Bottom banner/ }));
    await u.click(screen.getByRole('button', { name: '#E8453C' }));
    const priority = screen.getByLabelText('Priority');
    await u.clear(priority);
    await u.type(priority, '5');
    await u.click(screen.getByRole('switch', { name: 'Repeat weekly' }));
    await u.click(screen.getByRole('button', { name: 'Sat' }));
    await u.click(screen.getByRole('button', { name: 'Background #1F1A17' }));
    await u.click(screen.getByRole('radio', { name: 'Bottom left' }));
    await u.click(screen.getByRole('radio', { name: 'Outline' }));
    // Hex fields accept partial typing and only commit a complete colour.
    const textHex = screen.getByLabelText('Custom text colour');
    await u.type(textHex, '#ffcc0');
    expect(textHex).toHaveValue('#ffcc0');
    await u.type(textHex, '0');
    expect(textHex).toHaveValue('#FFCC00');
    await u.type(screen.getByLabelText('Custom pill colour'), '#123456');
    await u.click(screen.getByRole('button', { name: 'Pill text #FFFFFF' }));
    await u.click(screen.getByRole('button', { name: 'Create promotion' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/r/${ids.restaurant}/promotions`));
    const created = requests(spy).find(({ url, method }) => method === 'POST' && url.pathname === `${base}/promotions`);
    expect(created?.body).toEqual({
      template: 'notice',
      content: { headline: 'Ponedeljkom ne radimo', body: 'Vidimo se u utorak.' },
      title: 'Radno vreme',
      display: 'banner',
      accentColor: '#E8453C',
      priority: 5,
      isActive: true,
      startsAt: null,
      endsAt: null,
      recurrence: { weekdays: [1, 2, 3, 4, 5, 6], from: '16:00', to: '18:00' },
      style: { textColor: '#FFCC00', backgroundColor: '#1F1A17', pillPosition: 'left', pillColor: '#123456', pillStyle: 'outline', pillTextColor: '#FFFFFF' },
    });
  });

  it('edits the cocktail list: the preview renders the card in two columns and follows typing', async () => {
    const spy = mockApi({ session: sessionFor(user) }, promotionsApi());
    renderApp(`/r/${ids.restaurant}/promotions/${cocktail.id}`);
    const u = userEvent.setup();
    const preview = await screen.findByLabelText('Live promotion preview');
    const card = within(preview).getByRole('article', { name: 'Cocktail Menu' });
    expect(card.querySelectorAll('.promo-dl-col')).toHaveLength(2);
    expect(within(card).getByText('Negroni')).toBeInTheDocument();
    expect(within(card).getByText('Campari liker')).toBeInTheDocument();
    expect((card.closest('.promo-root') as HTMLElement).style.getPropertyValue('--promo-accent')).toBe('#E8453C');

    const name = screen.getByLabelText('Entry 1 name');
    await u.clear(name);
    await u.type(name, 'Negroni Sbagliato');
    expect(within(card).getByText('Negroni Sbagliato')).toBeInTheDocument();

    // Pick from the menu: the espresso becomes an entry linked to its item.
    await u.click(screen.getByRole('button', { name: 'Pick from menu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pick drinks' });
    await u.type(within(dialog).getByLabelText('Search items'), 'esp');
    await u.click(within(dialog).getByRole('button', { name: /Espresso/ }));
    await u.click(within(dialog).getByRole('button', { name: 'Add 1 item' }));
    expect(screen.getByLabelText('Entry 3 name')).toHaveValue('Espresso');
    expect(within(card).getByText('Espresso')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requests(spy).some(({ url, method }) => method === 'PATCH' && url.pathname === `${base}/promotions/${cocktail.id}`)).toBe(true));
    const patch = requests(spy).find(({ url, method }) => method === 'PATCH' && url.pathname === `${base}/promotions/${cocktail.id}`)!;
    const content = (patch.body as { content: { entries: { name: string; menuItemId?: string }[] } }).content;
    expect(content.entries.map((entry) => entry.name)).toEqual(['Negroni Sbagliato', 'Hugo', 'Espresso']);
    expect(content).toMatchObject({ variant: 'poster', icons: 'cocktails' });
    expect(content.entries[2]!.menuItemId).toBe(ids.espresso);
  });

  it('refuses to save an empty drink list and points at the problem', async () => {
    const spy = mockApi({ session: sessionFor(user) }, promotionsApi([]));
    renderApp(`/r/${ids.restaurant}/promotions/new`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('radio', { name: /^Drink list/ }));
    await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.type(screen.getByLabelText('Title'), 'Cocktails');
    await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Create promotion' }));
    expect((await screen.findAllByText(/entries: Add at least one entry/)).length).toBeGreaterThan(0);
    expect(requests(spy).some(({ url, method }) => method === 'POST' && url.pathname === `${base}/promotions`)).toBe(false);
  });

  it('deletes after confirming', async () => {
    const spy = mockApi({ session: sessionFor(user) }, promotionsApi());
    renderApp(`/r/${ids.restaurant}/promotions`);
    const u = userEvent.setup();
    await screen.findByRole('list', { name: 'Promotions' });
    await u.click(screen.getByRole('button', { name: 'More actions for Happy hour' }));
    await u.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await u.click(screen.getByRole('button', { name: 'Delete promotion' }));
    await waitFor(() => expect(requests(spy).some(({ url, method }) => method === 'DELETE' && url.pathname === `${base}/promotions/${off.id}`)).toBe(true));
    await waitFor(() => expect(screen.queryByText('Happy hour')).not.toBeInTheDocument());
  });

  it('shows the list read-only to staff', async () => {
    const staffSession = sessionFor(user);
    staffSession.memberships = staffSession.memberships.map((m) => ({ ...m, role: 'staff' as const }));
    mockApi({ session: staffSession }, promotionsApi());
    renderApp(`/r/${ids.restaurant}/promotions`);
    await screen.findByRole('list', { name: 'Promotions' });
    expect(screen.queryByRole('button', { name: 'New promotion' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Active: Cocktail Menu' })).toBeDisabled();
    expect(screen.getByText('The owner manages promotions.')).toBeInTheDocument();
  });
});
