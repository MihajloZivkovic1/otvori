import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDto, RestaurantDto } from '@qr-menu/shared';
import { ids, liveOrdering, MockEventSource, mockApi, renderApp, requests, restaurant, sessionFor, user, type FetchHandler } from './helpers';

beforeEach(() => {
  MockEventSource.instances = [];
});
afterEach(() => {
  document.title = '';
});

/** Ordering + payments on, mock provider configured; the live order store comes from `liveOrdering()`. */
function paymentsVenue(): { handler: FetchHandler; orders: OrderDto[] } {
  const live = liveOrdering('order');
  const venue: RestaurantDto = {
    ...restaurant,
    modules: { ordering: true, payments: true, pos: false },
    orderingMode: 'order',
    paymentConfig: { provider: 'mock', merchantId: 'DEMO-1', hasSecret: true, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true, simulator: true },
  };
  const handler: FetchHandler = (request) => {
    if (request.url.pathname === `/api/admin/restaurants/${ids.restaurant}` && request.method === 'GET') return { body: venue };
    if (request.url.pathname === `/api/admin/restaurants/${ids.restaurant}/payment-config` && request.method === 'GET') return { body: venue.paymentConfig };
    return live.handler(request);
  };
  return { handler, orders: live.orders };
}

describe('waiter screen → payment', () => {
  it('shows payment chips, lets the waiter take cash, and follows the stream when the guest pays online', async () => {
    vi.stubGlobal('EventSource', MockEventSource);
    const venue = paymentsVenue();
    const spy = mockApi({ session: sessionFor(user) }, venue.handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const typist = userEvent.setup();

    const progress = await screen.findByRole('region', { name: /In progress/ });
    const order141 = within(progress).getByRole('article', { name: 'Order #141, table 11' });
    expect(within(order141).getByText('Unpaid')).toBeInTheDocument();
    const fresh = screen.getByRole('region', { name: /New/ });
    expect(within(within(fresh).getByRole('article', { name: 'Order #142, table 7' })).getByText('Unpaid')).toBeInTheDocument();
    expect(within(within(fresh).getByRole('article', { name: 'Order #142, table 7' })).queryByRole('button', { name: /Cash/ })).toBeNull();

    await typist.click(within(order141).getByRole('button', { name: 'Cash for #141' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/orders/${ids.order141}/payment`));
      expect(patch?.body).toEqual({ paymentStatus: 'cash' });
    });
    await waitFor(() => expect(within(order141).getByText('Cash')).toBeInTheDocument());
    expect(within(order141).queryByRole('button', { name: 'Cash for #141' })).toBeNull();

    // The guest pays #142 online with a tip: order.updated over the stream.
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const stream = MockEventSource.instances[0]!;
    const order142 = venue.orders.find((o) => o.id === ids.order142)!;
    stream.emit({
      type: 'order.updated',
      order: { ...order142, paymentStatus: 'paid', tipCents: 17100, paidAmountCents: 188100, paidAt: '2026-10-22T11:50:00.000Z', updatedAt: '2026-10-22T11:50:00.000Z' },
    });
    const paid = await within(fresh).findByText('Paid · IPS · tip 171 RSD');
    expect(paid).toHaveAttribute('data-payment', 'paid');
  });

  it('shows no payment chips and no Cash button without the payments module', async () => {
    const live = liveOrdering('order');
    mockApi({ session: sessionFor(user) }, live.handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const progress = await screen.findByRole('region', { name: /In progress/ });
    expect(within(progress).queryByText('Unpaid')).toBeNull();
    expect(screen.queryByRole('button', { name: /Cash for/ })).toBeNull();
  });
});

describe('settings → Payment card', () => {
  it('shows the simulator badge, saves provider, merchant id, secret and tips, and tests the connection', async () => {
    const venue = paymentsVenue();
    const spy = mockApi({ session: sessionFor(user) }, venue.handler);
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Payment' });
    expect(await within(card).findByText('SIMULATOR')).toBeInTheDocument();
    expect(within(card).getByLabelText('Provider')).toHaveValue('mock');
    expect(within(card).getByLabelText('Merchant ID')).toHaveValue('DEMO-1');
    expect(within(card).getByLabelText('Secret')).toHaveAttribute('placeholder', '••••••••');
    expect(within(card).getByLabelText('Tip presets (%)')).toHaveValue('5, 10, 15');
    expect(within(card).getByRole('button', { name: 'Save' })).toBeDisabled();

    await typist.clear(within(card).getByLabelText('Merchant ID'));
    await typist.type(within(card).getByLabelText('Merchant ID'), 'KAFE-7');
    await typist.type(within(card).getByLabelText('Secret'), 'new-secret');
    await typist.clear(within(card).getByLabelText('Tip presets (%)'));
    await typist.type(within(card).getByLabelText('Tip presets (%)'), '10, 20');
    await typist.click(within(card).getByRole('switch', { name: 'E-mail the fiscal receipt' }));
    await typist.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith('/payment-config'));
      expect(patch?.body).toEqual({ provider: 'mock', merchantId: 'KAFE-7', secret: 'new-secret', tipPresets: [0, 10, 20], receiptEmailEnabled: false });
    });
    expect(await screen.findByText('Payment settings saved')).toBeInTheDocument();
    expect(within(card).getByLabelText('Secret')).toHaveValue('');

    await typist.click(within(card).getByRole('button', { name: 'Test connection' }));
    expect(await within(card).findByRole('status')).toHaveTextContent('Simulator ready');
  });

  it('is absent without the payments module and for staff', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('region', { name: 'Payment' })).toBeNull();

    const session = sessionFor(user);
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    mockApi({ session }, paymentsVenue().handler);
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findAllByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('region', { name: 'Payment' })).toBeNull();
  });
});

describe('analytics → online payments', () => {
  it('adds the paid-online tiles to the Ordering card with the module on', async () => {
    mockApi({ session: sessionFor(user) }, paymentsVenue().handler);
    renderApp(`/r/${ids.restaurant}/analytics`);
    const card = await screen.findByRole('region', { name: 'Ordering' });
    expect(within(card).getByText('paid online')).toBeInTheDocument();
    expect(within(card).getByText('41.200 RSD')).toBeInTheDocument();
    expect(within(card).getByText('tips')).toBeInTheDocument();
    expect(within(card).getByText('3.120 RSD')).toBeInTheDocument();
  });
});
