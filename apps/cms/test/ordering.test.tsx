import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ids, liveOrdering, MockEventSource, mockApi, orderingMode, orders, renderApp, requests, serviceRequests, sessionFor, user } from './helpers';

beforeEach(() => {
  MockEventSource.instances = [];
});
afterEach(() => {
  document.title = '';
});

describe('navigation gating', () => {
  it('hides "Orders" while ordering is off and never fetches orders', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });
    expect(screen.queryByRole('link', { name: /Orders/ })).toBeNull();
    expect(requests(spy).some((r) => r.url.pathname.endsWith('/orders'))).toBe(false);
    expect(document.title).toBe('Menu · Kafeterija Dorćol');
  });

  it('shows "Orders" with a badge that follows the stream', async () => {
    vi.stubGlobal('EventSource', MockEventSource);
    const live = liveOrdering('order');
    const spy = mockApi({ session: sessionFor(user) }, live.handler);
    renderApp(`/r/${ids.restaurant}/menu`);
    const link = await screen.findByRole('link', { name: /Orders/ });
    // 2 new orders + 1 open call from the API answers.
    await waitFor(() => expect(within(link).getByLabelText('3 open')).toBeInTheDocument());
    await waitFor(() => expect(document.title).toBe('(3) Menu · Kafeterija Dorćol'));

    await waitFor(() => expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname.endsWith('/sse-token'))).toBe(true));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const stream = MockEventSource.instances[0]!;
    expect(stream.url).toContain(`/api/admin/restaurants/${ids.restaurant}/events?token=sse-token`);
    stream.open();

    // Each event is what the server would also return on the next refetch.
    const created = { ...orders[0]!, id: 'new-order', number: 144, updatedAt: '2026-10-22T11:51:00.000Z' };
    live.orders.push(created);
    stream.emit({ type: 'order.created', order: created });
    await waitFor(() => expect(within(link).getByLabelText('4 open')).toBeInTheDocument());
    const done = { ...serviceRequests[0]!, status: 'done' as const, doneAt: '2026-10-22T11:52:00.000Z', updatedAt: '2026-10-22T11:52:00.000Z' };
    live.requests[0] = done;
    stream.emit({ type: 'request.updated', request: done });
    await waitFor(() => expect(within(link).getByLabelText('3 open')).toBeInTheDocument());
    const accepted = { ...orders[0]!, status: 'accepted' as const, acceptedAt: '2026-10-22T11:53:00.000Z', updatedAt: '2026-10-22T11:53:00.000Z', expiresAt: null };
    live.orders[0] = accepted;
    stream.emit({ type: 'order.updated', order: accepted });
    await waitFor(() => expect(within(link).getByLabelText('2 open')).toBeInTheDocument());
    expect(document.title).toBe('(2) Menu · Kafeterija Dorćol');
  });

  it('puts Orders in the phone tab bar and the Home card', async () => {
    mockApi({ session: sessionFor(user) }, orderingMode('call_waiter'));
    renderApp(`/r/${ids.restaurant}`, { viewport: 'mobile' });
    const card = await screen.findByRole('link', { name: /Orders: 3 open/ });
    expect(card).toHaveTextContent('2 new · 1 in progress · 1 call');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: /Orders/ })).toHaveAttribute('href', `/r/${ids.restaurant}/orders`);
    expect(within(nav).queryByRole('link', { name: /Analytics/ })).toBeNull();
  });
});

describe('waiter screen (mobile)', () => {
  it('accepts, delivers, rejects with a reason and closes calls', async () => {
    const spy = mockApi({ session: sessionFor(user) }, orderingMode('order'));
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const typist = userEvent.setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument(); // jsdom has no EventSource: polling mode
    const calls = await screen.findByRole('region', { name: /Calls/ });
    expect(within(calls).getByText('Table 4')).toBeInTheDocument();
    const fresh = screen.getByRole('region', { name: /New/ });
    const order142 = within(fresh).getByRole('article', { name: 'Order #142, table 7' });
    expect(within(order142).getByText('Marko')).toBeInTheDocument();
    expect(within(order142).getByText('“Sve odjednom, molim.”')).toBeInTheDocument();
    expect(within(order142).getByText('“bez čilija”')).toBeInTheDocument();
    expect(within(order142).getByText('1.710 RSD')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /In progress/ })).getByRole('article', { name: 'Order #141, table 11' })).toBeInTheDocument();

    await typist.click(within(order142).getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/orders/${ids.order142}`));
      expect(patch?.body).toEqual({ status: 'accepted' });
    });
    const progress = screen.getByRole('region', { name: /In progress/ });
    const accepted = await within(progress).findByRole('article', { name: 'Order #142, table 7' });
    expect(within(accepted).getByText(/accepted \d\d:\d\d/)).toBeInTheDocument();

    await typist.click(within(accepted).getByRole('button', { name: 'Delivered' }));
    await waitFor(() => {
      const patches = requests(spy).filter((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/orders/${ids.order142}`));
      expect(patches.at(-1)?.body).toEqual({ status: 'delivered' });
    });
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Order #142, table 7' })).toBeNull());

    const order143 = screen.getByRole('article', { name: 'Order #143, table 2' });
    await typist.click(within(order143).getByRole('button', { name: 'Reject' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reject #143 · Table 2' });
    await typist.click(within(sheet).getByRole('radio', { name: 'Pogrešan sto' }));
    await typist.type(within(sheet).getByLabelText(/Message to the guest/), 'Konobar dolazi.');
    await typist.click(within(sheet).getByRole('button', { name: 'Reject order' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/orders/${ids.order143}`));
      expect(patch?.body).toEqual({ status: 'rejected', rejectedReason: 'Pogrešan sto — Konobar dolazi.' });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await typist.click(within(calls).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/requests/${ids.call4}`));
      expect(patch?.body).toEqual({ status: 'done' });
    });
    const order141 = screen.getByRole('article', { name: 'Order #141, table 11' });
    await typist.click(within(order141).getByRole('button', { name: 'Delivered' }));
    // Everything handled: the empty state takes over, with today's totals.
    expect(await screen.findByText('No open orders')).toBeInTheDocument();
    expect(screen.getByText(/Today · 4 orders/)).toBeInTheDocument();
  });

  it('explains itself when ordering is off', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/orders`);
    expect(await screen.findByRole('heading', { name: 'Ordering is off' })).toBeInTheDocument();
  });
});

describe('settings → Ordering card', () => {
  it('lets the owner pick a mode, pause with a message and save', async () => {
    const spy = mockApi({ session: sessionFor(user) }, orderingMode('off'));
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Ordering' });
    expect(within(card).getByRole('radio', { name: /^Off/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(card).getByRole('button', { name: 'Save' })).toBeDisabled();

    await typist.click(within(card).getByRole('radio', { name: /^Ordering/ }));
    await typist.click(within(card).getByRole('switch', { name: 'Pause ordering' }));
    await typist.type(within(card).getByLabelText(/Message to guests while paused/), 'Kuhinja je zatvorena do 17:00.');
    await typist.click(within(card).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === `/api/admin/restaurants/${ids.restaurant}`);
      expect(patch?.body).toEqual({ orderingMode: 'order', orderingPaused: true, pausedMessage: 'Kuhinja je zatvorena do 17:00.' });
    });
    expect(await screen.findByText('Ordering settings saved')).toBeInTheDocument();
  });

  it('is hidden from staff', async () => {
    const session = sessionFor(user);
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    mockApi({ session }, orderingMode('off'));
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('region', { name: 'Ordering' })).toBeNull();
  });
});

describe('tables → block for 30 minutes', () => {
  it('blocks and unblocks a table and shows what the table has open', async () => {
    const spy = mockApi({ session: sessionFor(user) }, orderingMode('order'));
    renderApp(`/r/${ids.restaurant}/tables`);
    const typist = userEvent.setup();
    const list = await screen.findByRole('list', { name: 'Tables' });
    expect(await within(list).findByText('#142 new')).toBeInTheDocument();
    expect(within(list).getByText('1 call')).toBeInTheDocument();

    await typist.click(within(list).getByRole('button', { name: 'Block 30 min' }));
    await waitFor(() => expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname.endsWith(`/tables/${ids.table7}/block`))).toBe(true));
    expect(await within(list).findByText(/Blocked until \d\d:\d\d/)).toBeInTheDocument();
    expect(screen.getByText(/A guest at a blocked table sees/)).toBeInTheDocument();

    await typist.click(within(list).getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(requests(spy).some((r) => r.method === 'DELETE' && r.url.pathname.endsWith(`/tables/${ids.table7}/block`))).toBe(true));
    expect(await within(list).findByRole('button', { name: 'Block 30 min' })).toBeInTheDocument();
  });
});
