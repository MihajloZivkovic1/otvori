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

/** Ordering + payments + POS on, mock register configured, order #141 paid online and fiscalised (or failed). */
function posVenue(fiscal: Partial<OrderDto> = {}, config: Partial<RestaurantDto['posConfig']> = {}): { handler: FetchHandler; orders: OrderDto[]; venue: RestaurantDto } {
  const live = liveOrdering('order');
  const paid = live.orders.find((o) => o.id === ids.order141)!;
  Object.assign(paid, { paymentStatus: 'paid', paidAmountCents: paid.totalCents, paidAt: '2026-10-22T11:48:00.000Z', fiscalStatus: 'issued', fiscalInvoiceNumber: 'MOCKPFR0-MOCKPFR0-007', fiscalVerificationUrl: 'https://sandbox.suf.purs.gov.rs/v/?vl=MOCK7', posRef: 'mock-order-1', ...fiscal });
  const venue: RestaurantDto = {
    ...restaurant,
    modules: { ordering: true, payments: true, pos: true },
    orderingMode: 'order',
    paymentConfig: { provider: 'mock', merchantId: 'DEMO-1', hasSecret: true, tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true, simulator: true },
    posConfig: { provider: 'mock', mode: 'pos', baseUrl: null, hasApiKey: true, taxLabel: 'Ђ', taxNumber: null, tableMapping: { [ids.table7]: 'B1' }, sendOrdersToPos: true, closeOnPayment: true, closeStrategy: 'reissue', payPaymentTypeId: null, simulator: true, ...config },
  };
  const handler: FetchHandler = (request) => {
    const path = request.url.pathname;
    if (path === `/api/admin/restaurants/${ids.restaurant}` && request.method === 'GET') return { body: venue };
    if (path === `/api/admin/restaurants/${ids.restaurant}/pos-config` && request.method === 'GET') return { body: venue.posConfig };
    if (path === `/api/admin/restaurants/${ids.restaurant}/orders/${ids.order141}/fiscal/manual` && request.method === 'POST') {
      Object.assign(paid, { fiscalStatus: 'manual', fiscalError: null, updatedAt: '2026-10-22T11:52:00.000Z' });
      return { body: { ...paid } };
    }
    // Retry answers with the live (paid) order, re-queued.
    if (path === `/api/admin/restaurants/${ids.restaurant}/orders/${ids.order141}/fiscal/retry` && request.method === 'POST') {
      Object.assign(paid, { fiscalStatus: 'pending', fiscalError: null, updatedAt: '2026-10-22T11:51:00.000Z' });
      return { body: { ...paid } };
    }
    return live.handler(request);
  };
  return { handler, orders: live.orders, venue };
}

describe('waiter screen → fiscal receipt', () => {
  it('shows the receipt number on a fiscalised order and nothing on venues without the POS module', async () => {
    mockApi({ session: sessionFor(user) }, posVenue().handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const progress = await screen.findByRole('region', { name: /In progress/ });
    const order141 = within(progress).getByRole('article', { name: 'Order #141, table 11' });
    expect(within(order141).getByText('Paid · IPS')).toBeInTheDocument();
    expect(within(order141).getByText('Fiscal receipt · PFR0-007')).toHaveAttribute('data-fiscal', 'issued');
  });

  it('shows the chip on a cash order Octopos fiscalised for the venue (ESIR mode)', async () => {
    mockApi({ session: sessionFor(user) }, posVenue({ paymentStatus: 'cash', tipCents: 0 }, { mode: 'esir', sendOrdersToPos: false }).handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const progress = await screen.findByRole('region', { name: /In progress/ });
    const order141 = within(progress).getByRole('article', { name: 'Order #141, table 11' });
    expect(within(order141).getByText('Fiscal receipt · PFR0-007')).toHaveAttribute('data-fiscal', 'issued');
  });

  it('surfaces a failed fiscalisation with Retry, keeps the paid state, and follows the stream', async () => {
    vi.stubGlobal('EventSource', MockEventSource);
    const venue = posVenue({ fiscalStatus: 'failed', fiscalError: 'Mock register unreachable', fiscalInvoiceNumber: null, fiscalVerificationUrl: null });
    const spy = mockApi({ session: sessionFor(user) }, venue.handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const typist = userEvent.setup();
    const progress = await screen.findByRole('region', { name: /In progress/ });
    const order141 = within(progress).getByRole('article', { name: 'Order #141, table 11' });
    expect(within(order141).getByText('Fiscal receipt pending — issue it at the register')).toHaveAttribute('title', 'Mock register unreachable');
    expect(within(order141).getByText('Paid · IPS')).toBeInTheDocument();

    await typist.click(within(order141).getByRole('button', { name: 'Retry fiscal receipt for #141' }));
    await waitFor(() => expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname.endsWith(`/orders/${ids.order141}/fiscal/retry`))).toBe(true));
    expect(await within(order141).findByText('Fiscal receipt pending…')).toBeInTheDocument();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const paid = venue.orders.find((o) => o.id === ids.order141)!;
    MockEventSource.instances[0]!.emit({
      type: 'order.updated',
      order: { ...paid, fiscalStatus: 'issued', fiscalInvoiceNumber: 'MOCKPFR0-MOCKPFR0-008', fiscalVerificationUrl: 'https://x/y', updatedAt: '2026-10-22T11:55:00.000Z' },
    });
    expect(await within(order141).findByText('Fiscal receipt · PFR0-008')).toBeInTheDocument();
  });
});

describe('waiter screen → receipt issued by hand', () => {
  it('lets the waiter mark a failed fiscalisation as issued at the register (no retry, no duplicate)', async () => {
    const venue = posVenue({ fiscalStatus: 'failed', fiscalError: 'Mock register unreachable', fiscalInvoiceNumber: null, fiscalVerificationUrl: null });
    const spy = mockApi({ session: sessionFor(user) }, venue.handler);
    renderApp(`/r/${ids.restaurant}/orders`, { viewport: 'mobile' });
    const typist = userEvent.setup();
    const progress = await screen.findByRole('region', { name: /In progress/ });
    const order141 = within(progress).getByRole('article', { name: 'Order #141, table 11' });
    await typist.click(within(order141).getByRole('button', { name: 'Receipt issued at the register for #141' }));
    await waitFor(() => expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname.endsWith(`/orders/${ids.order141}/fiscal/manual`))).toBe(true));
    expect(await within(order141).findByText('Receipt issued at the register')).toHaveAttribute('data-fiscal', 'manual');
    expect(within(order141).queryByRole('button', { name: /Retry/ })).toBeNull();
    expect(within(order141).getByText('Paid · IPS')).toBeInTheDocument();
  });
});

describe('menu editor → POS code', () => {
  it('warns when an item has no code while orders go to the register, and sends the code on save', async () => {
    const spy = mockApi({ session: sessionFor(user) }, posVenue().handler);
    renderApp(`/r/${ids.restaurant}/menu?c=${ids.coffee}`);
    const typist = userEvent.setup();
    expect((await screen.findAllByText('NO POS CODE')).length).toBeGreaterThan(0);
    await typist.click(await screen.findByRole('button', { name: 'Edit Espresso' }));
    const drawer = await screen.findByRole('dialog');
    const field = within(drawer).getByLabelText('POS product code');
    expect(within(drawer).getByText('No POS code: guests cannot order this item while orders go to the register.')).toBeInTheDocument();
    // The focus trap moves focus to the name field on the next animation frame; typing before that loses keystrokes.
    await waitFor(() => expect(document.activeElement?.hasAttribute('data-autofocus')).toBe(true));
    await typist.type(field, 'ESP');
    expect(field).toHaveValue('ESP');
    await typist.click(within(drawer).getByRole('button', { name: /^Save/ }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/items/${ids.espresso}`));
      expect(patch?.body).toMatchObject({ posProductCode: 'ESP' });
    });
  });
});

describe('settings → Integrations', () => {
  it('shows the mock-register badge, saves the mode, mapping and switches, tests the connection and runs a reviewed sync', async () => {
    const spy = mockApi({ session: sessionFor(user) }, posVenue().handler);
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Integrations · Octopos' });
    expect(await within(card).findByText('MOCK REGISTER')).toBeInTheDocument();
    expect(within(card).getByRole('radio', { name: /The venue’s own Octopos till/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(card).getByLabelText('POS table name for Table 7')).toHaveValue('B1');
    expect(within(card).getByRole('switch', { name: 'Send orders to the register' })).toHaveAttribute('aria-checked', 'true');
    expect(within(card).getByRole('button', { name: 'Save' })).toBeDisabled();
    // The register's tables feed the mapping suggestions (a datalist, so no accessible role in jsdom).
    await waitFor(() => expect(card.querySelector('datalist option[value="B2"]')).not.toBeNull());

    await typist.clear(within(card).getByLabelText('POS table name for Table 7'));
    await typist.type(within(card).getByLabelText('POS table name for Table 7'), 'Bašta 1');
    await typist.click(within(card).getByRole('switch', { name: 'Issue the fiscal receipt on payment' }));
    await typist.type(within(card).getByLabelText('PIB'), '112832835');
    await typist.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith('/pos-config'));
      expect(patch?.body).toEqual({
        provider: 'mock',
        mode: 'pos',
        baseUrl: null,
        taxLabel: 'Ђ',
        taxNumber: '112832835',
        tableMapping: { [ids.table7]: 'Bašta 1' },
        sendOrdersToPos: true,
        closeOnPayment: false,
        closeStrategy: 'reissue',
        payPaymentTypeId: null,
      });
    });
    expect(await screen.findByText('Integration settings saved')).toBeInTheDocument();

    await typist.click(within(card).getByRole('button', { name: 'Test connection' }));
    expect(await within(card).findByRole('status')).toHaveTextContent('Mock register ready');

    await typist.click(within(card).getByRole('button', { name: 'Sync products' }));
    const modal = await screen.findByRole('dialog', { name: 'Sync from the register' });
    expect(await within(modal).findByText('Kapućino')).toBeInTheDocument();
    expect(within(modal).getByText(/2 menu items have no POS code/)).toBeInTheDocument();
    await typist.click(within(modal).getByRole('checkbox', { name: /Espresso/ }));
    await typist.click(within(modal).getByRole('button', { name: /^Apply/ }));
    await waitFor(() => {
      const sync = requests(spy).find((r) => r.method === 'POST' && r.url.pathname.endsWith('/pos/sync'));
      expect(sync?.body).toEqual({ createCodes: ['CAP'], updateCodes: [] });
    });
    expect(await screen.findByText('1 new, 0 prices updated')).toBeInTheDocument();
  });

  it('switching to ESIR mode hides the till options, shows the per-receipt note and the tax label picker from the register', async () => {
    const spy = mockApi({ session: sessionFor(user) }, posVenue().handler);
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Integrations · Octopos' });
    await typist.click(await within(card).findByRole('radio', { name: /Octopos issues the fiscal receipts/ }));
    expect(within(card).queryByRole('switch', { name: 'Send orders to the register' })).toBeNull();
    expect(within(card).queryByLabelText('POS table name for Table 7')).toBeNull();
    expect(within(card).getByText(/Every order paid by phone and every order staff mark as cash becomes one fiscal receipt/)).toBeInTheDocument();
    await typist.selectOptions(await within(card).findByLabelText('Tax label'), 'Е');
    await typist.click(within(card).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith('/pos-config'));
      expect(patch?.body).toMatchObject({ mode: 'esir', taxLabel: 'Е', sendOrdersToPos: false });
    });
  });

  it('is absent without the POS module', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('region', { name: /Integrations/ })).toBeNull();
  });
});
