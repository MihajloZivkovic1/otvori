import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RestaurantDto, SuperadminRestaurantDto } from '@qr-menu/shared';
import { ids, mockApi, renderApp, requests, restaurant, sessionFor, superadmin, superadminRows, user, type FetchHandler } from './helpers';

/** A deployment with FEATURE_PAYMENTS=false: /api/config says so, and (like the real API) every DTO masks the module. */
function paymentsOff(venue: Partial<RestaurantDto> = {}): FetchHandler {
  const current: RestaurantDto = { ...restaurant, modules: { ordering: true, payments: false, pos: true }, orderingMode: 'order', ...venue };
  return ({ url, method }) => {
    if (url.pathname === '/api/config') return { body: { version: 'test', features: { payments: false, pos: true } } };
    if (url.pathname === `/api/admin/restaurants/${ids.restaurant}` && method === 'GET') return { body: current };
    return undefined;
  };
}

describe('global feature flags (FEATURE_PAYMENTS=false)', () => {
  it('keeps the payment settings card away even if the venue claims the module, while POS stays', async () => {
    // A stale or hand-edited payload with payments:true must not bring the UI back: the flag wins.
    const spy = mockApi({ session: sessionFor(user) }, paymentsOff({ modules: { ordering: true, payments: true, pos: true } }));
    renderApp(`/r/${ids.restaurant}/settings`);
    await screen.findByRole('heading', { name: 'Settings' });
    await waitFor(() => expect(requests(spy).some((r) => r.url.pathname === '/api/config')).toBe(true));
    expect(screen.getByRole('region', { name: /Integrations/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Payment' })).toBeNull();
    expect(requests(spy).some((r) => r.url.pathname.endsWith('/payment-config'))).toBe(false);
  });

  it('tells owners the module is not available yet instead of offering a contact link', async () => {
    mockApi({ session: sessionFor(user) }, paymentsOff());
    renderApp(`/r/${ids.restaurant}/settings/modules`);
    const payments = await screen.findByRole('region', { name: 'Online payment' });
    await waitFor(() => expect(within(payments).getByText('Not available yet')).toBeInTheDocument());
    expect(within(payments).queryByRole('link', { name: 'Contact us to enable' })).toBeNull();
    expect(within(payments).queryByRole('switch')).toBeNull();
    // POS keeps its normal "enabled by otvori" state.
    const pos = screen.getByRole('region', { name: 'POS integration' });
    expect(within(pos).getByText('On')).toBeInTheDocument();
  });

  it('disables the superadmin switch with "Not available yet" and never sends payments:true', async () => {
    const row = superadminRows[0]!;
    const spy = mockApi({ session: sessionFor(superadmin) }, ({ url, method, body }) => {
      if (url.pathname === '/api/config') return { body: { version: 'test', features: { payments: false, pos: true } } };
      if (url.pathname === `/api/superadmin/restaurants/${row.id}` && method === 'PATCH') return { body: { ...row, ...(body as Partial<SuperadminRestaurantDto>) } };
      return undefined;
    });
    renderApp(`/admin/restaurants/${row.id}/plan`);
    const typist = userEvent.setup();
    const panel = await screen.findByRole('tabpanel', { name: 'Plan & modules' });
    const paymentsSwitch = within(panel).getByRole('switch', { name: 'Online payment' });
    await waitFor(() => expect(paymentsSwitch).toBeDisabled());
    expect(within(panel).getByText(/Not available yet/)).toBeInTheDocument();
    expect(within(panel).getByRole('switch', { name: 'POS integration' })).toBeEnabled();
    await typist.click(within(panel).getByRole('switch', { name: 'POS integration' }));
    await typist.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === `/api/superadmin/restaurants/${row.id}`);
      expect(patch?.body).toMatchObject({ modules: { payments: false, pos: true } });
    });
  });
});
