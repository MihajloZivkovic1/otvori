import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { OrderStatus, PublicOrderDto } from '@qr-menu/shared';
import {
  bodiesFor,
  ids,
  menuCallsOnly,
  menuOrdering,
  menuPaused,
  mockFetch,
  renderMenu,
  requests,
  type FetchHandler,
} from './helpers';

const ORDER_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';

function orderDto(overrides: Partial<PublicOrderDto> = {}): PublicOrderDto {
  return {
    id: ORDER_ID,
    number: 142,
    status: 'new',
    tableNumber: 7,
    guestName: null,
    note: null,
    totalCents: 25000,
    currency: 'RSD',
    locale: 'sr',
    rejectedReason: null,
    items: [
      { id: 'line-1', menuItemId: ids.cappuccino, variantId: null, name: 'Kapućino', variantName: null, unitPriceCents: 25000, quantity: 1, lineTotalCents: 25000, lineNote: null },
    ],
    createdAt: '2026-10-22T11:42:00.000Z',
    acceptedAt: null,
    deliveredAt: null,
    closedAt: null,
    expiresAt: '2026-10-22T12:02:00.000Z',
    ...overrides,
  };
}

/** Menu in order mode + an in-memory order store: POST creates from the body, GET/cancel read and update it. */
function orderingApi(menu = menuOrdering, initial: PublicOrderDto | null = null): { handler: FetchHandler; orders: Map<string, PublicOrderDto> } {
  const orders = new Map<string, PublicOrderDto>();
  if (initial) orders.set(initial.id, initial);
  const handler: FetchHandler = (url, init) => {
    const path = url.pathname;
    if (path.endsWith('/events')) return { status: 202, body: { ok: true } };
    if (path.endsWith('/requests')) return { status: 201, body: { id: 'req-1', type: 'call_waiter', status: 'open', createdAt: '', updatedAt: '' } };
    if (path.endsWith('/orders') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { tableNumber: number; items: { itemId: string; variantId?: string; quantity: number; note?: string }[]; note?: string; guestName?: string };
      const items = body.items.map((line, index) => {
        const unit = line.itemId === ids.espresso ? (line.variantId === ids.espressoDouble ? 22000 : 18000) : 25000;
        return {
          id: `line-${index}`,
          menuItemId: line.itemId,
          variantId: line.variantId ?? null,
          name: line.itemId === ids.espresso ? 'Espresso' : 'Kapućino',
          variantName: line.variantId === ids.espressoDouble ? 'Double' : line.variantId === ids.espressoSingle ? 'Single' : null,
          unitPriceCents: unit,
          quantity: line.quantity,
          lineTotalCents: unit * line.quantity,
          lineNote: line.note ?? null,
        };
      });
      const order = orderDto({ tableNumber: body.tableNumber, note: body.note ?? null, guestName: body.guestName ?? null, items, totalCents: items.reduce((s, l) => s + l.lineTotalCents, 0) });
      orders.set(order.id, order);
      return { status: 201, body: order };
    }
    const cancel = /\/orders\/([^/]+)\/cancel$/.exec(path);
    if (cancel) {
      const order = orders.get(cancel[1]!)!;
      const next = { ...order, status: 'cancelled' as const, closedAt: '2026-10-22T11:45:00.000Z', expiresAt: null };
      orders.set(order.id, next);
      return { body: next };
    }
    const read = /\/orders\/([^/]+)$/.exec(path);
    if (read) {
      const order = orders.get(read[1]!);
      return order ? { body: order } : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Order not found' } } };
    }
    return { body: menu };
  };
  return { handler, orders };
}

describe('cart', () => {
  it('adds items with "+", merges identical lines, totals them and persists per tenant', async () => {
    mockFetch(orderingApi().handler);
    const user = userEvent.setup();
    renderMenu('/r/kafeterija/t/7');

    await user.click(await screen.findByRole('button', { name: 'Dodaj u korpu: Kapućino' }));
    expect(await screen.findByText('Dodato u korpu · Kapućino')).toBeInTheDocument();
    const bar = screen.getByRole('button', { name: /Pogledaj korpu/ });
    expect(bar).toHaveTextContent('1');
    expect(bar).toHaveTextContent('250 RSD');

    await user.click(screen.getByRole('button', { name: 'Dodaj u korpu: Kapućino' }));
    expect(bar).toHaveTextContent('2');
    expect(bar).toHaveTextContent('500 RSD');
    expect(screen.queryByRole('button', { name: /Dodaj u korpu: Tost sa avokadom/ })).toBeNull(); // unavailable: no "+"

    // Items with variants open the sheet: pick Double, two of them, with a note.
    await user.click(screen.getByRole('button', { name: 'Dodaj u korpu: Espresso' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Single/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(dialog).getByRole('radio', { name: /Double/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Povećaj: Espresso' }));
    await user.type(within(dialog).getByLabelText(/Napomena uz stavku/), 'bez šećera');
    expect(within(dialog).getByText('10/80')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Dodaj.*440\sRSD/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /Pogledaj korpu/ })).toHaveTextContent('940 RSD');

    const stored = JSON.parse(sessionStorage.getItem('tabla.cart.kafeterija')!) as { itemId: string; variantId: string | null; quantity: number; note: string }[];
    expect(stored).toEqual([
      expect.objectContaining({ itemId: ids.cappuccino, variantId: null, quantity: 2, note: '' }),
      expect.objectContaining({ itemId: ids.espresso, variantId: ids.espressoDouble, quantity: 2, note: 'bez šećera' }),
    ]);
  });

  it('changes quantities in the cart sheet and removes a line at zero', async () => {
    mockFetch(orderingApi().handler);
    sessionStorage.setItem('tabla.cart.kafeterija', JSON.stringify([{ key: `${ids.cappuccino}||`, itemId: ids.cappuccino, variantId: null, quantity: 2, note: '' }]));
    const user = userEvent.setup();
    renderMenu('/r/kafeterija/t/7');

    await user.click(await screen.findByRole('button', { name: /Pogledaj korpu/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Korpa' });
    expect(within(sheet).getByText('2 stavke')).toBeInTheDocument();
    expect(within(sheet).getAllByText('500 RSD')).toHaveLength(2); // line total + total
    expect(within(sheet).queryByLabelText('Broj stola')).toBeNull(); // the table came from the QR code

    await user.click(within(sheet).getByRole('button', { name: 'Smanji: Kapućino' }));
    expect(within(sheet).getByText('1 stavka')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Smanji: Kapućino' }));
    expect(within(sheet).getByText('Korpa je prazna.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Pošalji konobaru' })).toBeDisabled();
    expect(sessionStorage.getItem('tabla.cart.kafeterija')).toBeNull();
  });
});

describe('sending an order', () => {
  it('posts the cart with the session id, clears it and opens the status page', async () => {
    const { handler } = orderingApi();
    const spy = mockFetch(handler);
    const user = userEvent.setup();
    renderMenu('/r/kafeterija/t/7');

    await user.click(await screen.findByRole('button', { name: 'Dodaj u korpu: Kapućino' }));
    await user.click(screen.getByRole('button', { name: /Pogledaj korpu/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Korpa' });
    await user.type(within(sheet).getByLabelText(/Napomena za konobara/), 'Sve odjednom, molim.');
    await user.type(within(sheet).getByLabelText('Ime (opciono)'), 'Marko');
    await user.click(within(sheet).getByRole('button', { name: 'Pošalji konobaru' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Narudžbina #142' })).toBeInTheDocument();
    expect(screen.getByText('Poslato konobaru')).toBeInTheDocument();
    expect(screen.getByText('Osvežava se automatski')).toBeInTheDocument();
    expect(screen.getByText('“Sve odjednom, molim.”')).toBeInTheDocument();

    const post = requests(spy).find((r) => r.url.pathname.endsWith('/orders') && r.init?.method === 'POST')!;
    expect(new Headers(post.init?.headers).get('X-Session-Id')).toBe(sessionStorage.getItem('tabla.session'));
    expect(bodiesFor(spy, '/orders')[0]).toEqual({
      tableNumber: 7,
      items: [{ itemId: ids.cappuccino, quantity: 1 }],
      note: 'Sve odjednom, molim.',
      guestName: 'Marko',
      locale: 'sr',
    });
    expect(sessionStorage.getItem('tabla.cart.kafeterija')).toBeNull();
    const remembered = JSON.parse(sessionStorage.getItem('tabla.orders.kafeterija')!) as { id: string; status: string }[];
    expect(remembered).toEqual([expect.objectContaining({ id: ORDER_ID, status: 'new' })]);

    // Back on the menu the header links to the order.
    await user.click(screen.getByRole('link', { name: 'Meni' }));
    const link = await screen.findByRole('link', { name: /Tvoje narudžbine/ });
    expect(link).toHaveTextContent('1');
    expect(link).toHaveAttribute('href', `/r/kafeterija/order/${ORDER_ID}`);
  });

  it('asks for the table number when the QR code did not carry one', async () => {
    const spy = mockFetch(orderingApi().handler);
    const user = userEvent.setup();
    renderMenu('/r/kafeterija');

    await user.click(await screen.findByRole('button', { name: 'Dodaj u korpu: Kapućino' }));
    await user.click(screen.getByRole('button', { name: /Pogledaj korpu/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Korpa' });
    expect(within(sheet).getByText(/Broj stola piše na kartici/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Pošalji konobaru' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Upiši broj stola');
    expect(bodiesFor(spy, '/orders')).toHaveLength(0);

    await user.type(within(sheet).getByLabelText('Broj stola'), '5');
    await user.click(within(sheet).getByRole('button', { name: 'Pošalji konobaru' }));
    await screen.findByRole('heading', { level: 1, name: 'Narudžbina #142' });
    expect(bodiesFor(spy, '/orders')[0]).toMatchObject({ tableNumber: 5 });
    expect(sessionStorage.getItem('tabla.table.kafeterija')).toBe('5');
  });

  it('shows the API reason when the order is refused', async () => {
    const base = orderingApi().handler;
    mockFetch((url, init) =>
      url.pathname.endsWith('/orders') && init?.method === 'POST'
        ? { status: 423, body: { error: { code: 'TABLE_BLOCKED', message: 'Ordering from this table is temporarily disabled.' } } }
        : base(url, init),
    );
    const user = userEvent.setup();
    renderMenu('/r/kafeterija/t/7');
    await user.click(await screen.findByRole('button', { name: 'Dodaj u korpu: Kapućino' }));
    await user.click(screen.getByRole('button', { name: /Pogledaj korpu/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Korpa' });
    await user.click(within(sheet).getByRole('button', { name: 'Pošalji konobaru' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Naručivanje sa ovog stola je privremeno onemogućeno. Pozovite konobara.');
    expect(sessionStorage.getItem('tabla.cart.kafeterija')).not.toBeNull();
  });
});

describe('order status page', () => {
  const render = (status: OrderStatus, extra: Partial<PublicOrderDto> = {}) => {
    const api = orderingApi(menuOrdering, orderDto({ status, ...extra }));
    const spy = mockFetch(api.handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    return { spy, orders: api.orders };
  };

  it('lets the guest cancel while the order is new', async () => {
    const { spy } = render('new');
    const user = userEvent.setup();
    expect(await screen.findByText('Poslato konobaru')).toBeInTheDocument();
    expect(screen.getByText(/Poslato u 13:42 · Kafeterija Dorćol/)).toBeInTheDocument();
    expect(screen.getByText('Sto 7')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Otkaži narudžbinu' }));
    await user.click(screen.getByRole('button', { name: 'Da, otkaži' }));
    expect(await screen.findByText('Narudžbina je otkazana')).toBeInTheDocument();
    expect(requests(spy).some((r) => r.url.pathname.endsWith(`/orders/${ORDER_ID}/cancel`))).toBe(true);
    expect(screen.queryByText('Osvežava se automatski')).toBeNull();
    expect(screen.getByRole('button', { name: 'Naruči ponovo' })).toBeInTheDocument();
  });

  it('shows progress for accepted and the way back for delivered orders', async () => {
    render('accepted', { acceptedAt: '2026-10-22T11:44:00.000Z' });
    expect(await screen.findByText('Prihvaćeno', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Konobar je preuzeo narudžbinu i priprema je.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otkaži narudžbinu' })).toBeNull();
  });

  it('renders the rejection reason and the expired copy', async () => {
    render('rejected', { rejectedReason: 'Šakšuka je rasprodata za danas.', closedAt: '2026-10-22T11:45:00.000Z', expiresAt: null });
    expect(await screen.findByText('Konobar nije mogao da prihvati narudžbinu')).toBeInTheDocument();
    expect(screen.getByText(/Šakšuka je rasprodata za danas\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Naruči ponovo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pozovi konobara' })).toBeInTheDocument();
  });

  it('delivered orders link back to the menu; expired ones explain the 20 minutes', async () => {
    const { orders } = render('delivered', { deliveredAt: '2026-10-22T11:55:00.000Z', closedAt: '2026-10-22T11:55:00.000Z', expiresAt: null });
    expect(await screen.findByText('Prijatno! Račun tražiš od konobara kad budeš spreman.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nazad na meni' })).toHaveAttribute('href', '/r/kafeterija');
    orders.set(ORDER_ID, orderDto({ status: 'expired', closedAt: '2026-10-22T12:02:00.000Z', expiresAt: null }));
  });

  it('explains an expired order', async () => {
    render('expired', { closedAt: '2026-10-22T12:02:00.000Z', expiresAt: null });
    expect(await screen.findByText('Narudžbina je istekla')).toBeInTheDocument();
    expect(screen.getByText(/u roku od 20 minuta/)).toBeInTheDocument();
  });

  it('shows a not-found screen for an order from another phone', async () => {
    mockFetch(orderingApi().handler);
    renderMenu(`/r/kafeterija/order/${ORDER_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Narudžbina nije pronađena' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nazad na meni' })).toBeInTheDocument();
  });
});

describe('calling the waiter', () => {
  it('sends the request, then shows the chip and a 60 s cooldown that survives a reload', async () => {
    const spy = mockFetch(orderingApi(menuCallsOnly).handler);
    const user = userEvent.setup();
    const { unmount } = renderMenu('/r/kafeterija/t/7');

    const button = await screen.findByRole('button', { name: 'Pozovi konobara' });
    expect(screen.queryByRole('button', { name: /Dodaj u korpu/ })).toBeNull(); // call_waiter mode: no "+"
    await user.click(button);
    await waitFor(() => expect(bodiesFor(spy, '/requests')).toEqual([{ type: 'call_waiter', tableNumber: 7 }]));
    expect(await screen.findByText('Konobar je obavešten')).toBeInTheDocument();
    const cooling = screen.getByRole('button', { name: /Pozvano · [01]:[0-5]\d/ });
    expect(cooling).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Račun' })).toBeEnabled();
    expect(Number(sessionStorage.getItem('tabla.call.kafeterija.call_waiter'))).toBeGreaterThan(0);

    unmount();
    renderMenu('/r/kafeterija/t/7');
    expect(await screen.findByRole('button', { name: /Pozvano · / })).toBeDisabled();

    // An old timestamp does not block the button.
    sessionStorage.setItem('tabla.call.kafeterija.call_waiter', String(Date.now() - 61_000));
    unmount();
  });

  it('is enabled again once the cooldown has passed', async () => {
    sessionStorage.setItem('tabla.call.kafeterija.call_waiter', String(Date.now() - 61_000));
    mockFetch(orderingApi(menuCallsOnly).handler);
    renderMenu('/r/kafeterija/t/7');
    expect(await screen.findByRole('button', { name: 'Pozovi konobara' })).toBeEnabled();
    expect(screen.queryByText('Konobar je obavešten')).toBeNull();
  });

  it('asks for the table number first when none is known', async () => {
    const spy = mockFetch(orderingApi(menuCallsOnly).handler);
    const user = userEvent.setup();
    renderMenu('/r/kafeterija');
    await user.click(await screen.findByRole('button', { name: 'Račun' }));
    const prompt = await screen.findByRole('dialog', { name: 'Broj stola' });
    await user.type(within(prompt).getByLabelText('Broj stola'), '3');
    await user.click(within(prompt).getByRole('button', { name: 'Potvrdi' }));
    await waitFor(() => expect(bodiesFor(spy, '/requests')).toEqual([{ type: 'bill', tableNumber: 3 }]));
    expect(await screen.findByText('Sto 3')).toBeInTheDocument();
  });
});

describe('paused and view-only menus', () => {
  it('shows the banner and hides "+" and the cart while paused, calls still work', async () => {
    sessionStorage.setItem('tabla.cart.kafeterija', JSON.stringify([{ key: `${ids.cappuccino}||`, itemId: ids.cappuccino, variantId: null, quantity: 1, note: '' }]));
    mockFetch(orderingApi(menuPaused).handler);
    renderMenu('/r/kafeterija/t/7');
    expect(await screen.findByText('Naručivanje je trenutno pauzirano')).toBeInTheDocument();
    expect(screen.getByText('Kuhinja je zatvorena do 17:00.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dodaj u korpu/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pogledaj korpu/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pozovi konobara' })).toBeEnabled();
  });

  it('keeps the plain menu when ordering is off', async () => {
    mockFetch((url) => (url.pathname.endsWith('/events') ? { status: 202, body: { ok: true } } : { body: { ...menuOrdering, restaurant: { ...menuOrdering.restaurant, orderingMode: 'off' } } }));
    renderMenu('/r/kafeterija/t/7');
    await screen.findByText('Espresso');
    expect(screen.queryByRole('button', { name: /Dodaj u korpu/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pozovi konobara' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Tvoje narudžbine/ })).toBeNull();
  });
});
