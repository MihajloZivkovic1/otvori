import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RestaurantDto, SuperadminRestaurantDto } from '@qr-menu/shared';
import { ids, mockApi, renderApp, requests, restaurant, sessionFor, superadmin, superadminRows, user, type FetchHandler } from './helpers';

/** GET /restaurant answers with these modules and mode; PATCH echoes the merged modules like the API does. */
function venue(modules: Partial<RestaurantDto['modules']>, orderingMode: RestaurantDto['orderingMode'] = 'order'): FetchHandler {
  const current: RestaurantDto = { ...restaurant, modules: { ...restaurant.modules, ...modules }, orderingMode };
  return ({ url, method, body }) => {
    if (url.pathname !== `/api/admin/restaurants/${ids.restaurant}`) return undefined;
    if (method === 'GET') return { body: current };
    if (method === 'PATCH') {
      const patch = body as { modules?: Partial<RestaurantDto['modules']> };
      current.modules = { ...current.modules, ...patch.modules };
      return { body: current };
    }
    return undefined;
  };
}

describe('modules', () => {
  it('keeps the whole ordering UI away while the module is off, even with orderingMode = order', async () => {
    const spy = mockApi({ session: sessionFor(user) }, venue({ ordering: false }, 'order'));
    renderApp(`/r/${ids.restaurant}/tables`);
    await screen.findByRole('heading', { name: 'Tables & QR codes' });
    expect(screen.queryByRole('link', { name: /Orders/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Block 30 min/ })).toBeNull();
    expect(requests(spy).some((r) => r.url.pathname.endsWith('/orders') || r.url.pathname.endsWith('/sse-token'))).toBe(false);
  });

  it('shows "Orders" once the module is on', async () => {
    mockApi({ session: sessionFor(user) }, venue({ ordering: true }, 'order'));
    renderApp(`/r/${ids.restaurant}/menu`);
    expect(await screen.findByRole('link', { name: /Orders/ })).toBeInTheDocument();
  });

  it('hides the Ordering card from Settings without the module and links to the Modules page', async () => {
    mockApi({ session: sessionFor(user) }, venue({ ordering: false }));
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('region', { name: 'Ordering' })).toBeNull();
    const card = screen.getByRole('region', { name: 'Modules' });
    expect(card).toHaveTextContent('Plain QR menu');
    expect(within(card).getByRole('link', { name: 'Manage' })).toHaveAttribute('href', `/r/${ids.restaurant}/settings/modules`);
  });

  it('lets the owner switch ordering on and sends only that module', async () => {
    const spy = mockApi({ session: sessionFor(user) }, venue({ ordering: false }));
    renderApp(`/r/${ids.restaurant}/settings/modules`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Ordering' });
    expect(within(card).getByText('Off')).toBeInTheDocument();
    await typist.click(within(card).getByRole('switch', { name: 'Ordering' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === `/api/admin/restaurants/${ids.restaurant}`);
      expect(patch?.body).toEqual({ modules: { ordering: true } });
    });
    expect(await screen.findByText('Ordering switched on')).toBeInTheDocument();
    // Switching the module on swaps the ordering provider to its live tree, which remounts the page: re-query the card.
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Ordering' })).getByText('On')).toBeInTheDocument());
    // The sidebar follows: Orders appears without a reload.
    expect(await screen.findByRole('link', { name: /Orders/ })).toBeInTheDocument();
  });

  it('offers payments and POS as "contact us" to owners', async () => {
    mockApi({ session: sessionFor(user) }, venue({ ordering: true, payments: false, pos: true }));
    renderApp(`/r/${ids.restaurant}/settings/modules`);
    const payments = await screen.findByRole('region', { name: 'Online payment' });
    expect(within(payments).queryByRole('switch')).toBeNull();
    expect(within(payments).getByRole('link', { name: 'Contact us to enable' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:zdravo@otvori.menu'),
    );
    const pos = screen.getByRole('region', { name: 'POS integration' });
    expect(within(pos).getByText('On')).toBeInTheDocument();
    expect(within(pos).getByText(/Enabled by otvori/)).toBeInTheDocument();
  });

  it('shows staff the switch disabled', async () => {
    const session = sessionFor(user);
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    mockApi({ session }, venue({ ordering: true }));
    renderApp(`/r/${ids.restaurant}/settings/modules`);
    const ordering = await screen.findByRole('region', { name: 'Ordering' });
    expect(within(ordering).getByRole('switch', { name: 'Ordering' })).toBeDisabled();
    expect(within(ordering).getByText('Only owners can switch modules.')).toBeInTheDocument();
  });

  it('gives superadmins switches for every module', async () => {
    const row = superadminRows[0]!;
    const spy = mockApi({ session: sessionFor(superadmin) }, ({ url, method, body }) =>
      url.pathname === `/api/superadmin/restaurants/${row.id}` && method === 'PATCH'
        ? { body: { ...row, ...(body as Partial<SuperadminRestaurantDto>) } }
        : undefined,
    );
    renderApp('/superadmin');
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: `Manage ${row.name}` }));
    const dialog = await screen.findByRole('dialog');
    await typist.click(within(dialog).getByRole('switch', { name: 'Online payment' }));
    await typist.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === `/api/superadmin/restaurants/${row.id}`);
      expect(patch?.body).toMatchObject({ modules: { ordering: true, payments: true, pos: false } });
    });
  });
});
