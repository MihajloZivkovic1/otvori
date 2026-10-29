import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, impersonation, mockApi, renderApp, requests, restaurant, sessionFor, superadmin, user } from './helpers';

/** A superadmin who is not a member of any venue (the usual case: the seed admin). */
const adminOnly = () => ({ ...sessionFor(superadmin), memberships: [] });

describe('superadmin area (Phase 13a)', () => {
  it('hides the superadmin entry from regular owners', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });
    await userEvent.setup().click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    expect(within(menu).getByRole('menuitem', { name: /Kafeterija Dorćol/ })).toBeInTheDocument();
    expect(within(menu).queryByText('Superadmin area')).not.toBeInTheDocument();
    expect(within(menu).queryByText('SUPERADMIN')).not.toBeInTheDocument();
  });

  it('keeps /admin away from non-superadmins', async () => {
    mockApi({ session: sessionFor(user) });
    const { router } = renderApp('/admin/restaurants');
    await screen.findByRole('heading', { name: 'Kafa' });
    expect(router.state.location.pathname).toBe(`/r/${ids.restaurant}/menu`);
  });

  it('opens its own shell from the switcher, with nothing of the last venue in it', async () => {
    mockApi({ session: sessionFor(superadmin) });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });
    // The venue was remembered as the last used one …
    await waitFor(() => expect(localStorage.getItem(`tabla.cms.lastRestaurant.${ids.admin}`)).toBe(ids.restaurant));

    const typist = userEvent.setup();
    await typist.click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    const entry = within(menu).getByRole('menuitem', { name: /Superadmin area/ });
    expect(within(entry).getByText('SUPERADMIN')).toBeInTheDocument();
    expect(within(menu).getByRole('searchbox', { name: 'Search all venues' })).toBeInTheDocument();
    await typist.click(entry);

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/restaurants'));
    expect(await screen.findByRole('heading', { name: 'Restaurants' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open Kafeterija Dorćol' })).toBeInTheDocument();
    expect(screen.getByText('Beograd', { exact: false })).toBeInTheDocument();

    // … and the admin shell carries none of it: no venue switcher, no venue nav, no publish pill, no live menu link.
    expect(screen.queryByRole('button', { name: /Kafeterija Dorćol/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
    expect(screen.queryByText('View live menu')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Superadmin sections' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Restaurants', 'Users', 'Activity', 'System']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Superadmin');
    // Entering the admin area forgets the active venue, so "/" lands in the admin area next time.
    expect(localStorage.getItem(`tabla.cms.lastRestaurant.${ids.admin}`)).toBeNull();
  });

  it('shows the restaurant detail with tabs and enters the venue through "Open as owner"', async () => {
    const spy = mockApi({ session: adminOnly() });
    const { router } = renderApp(`/admin/restaurants`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('link', { name: 'Open Kafeterija Dorćol' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${ids.restaurant}`));
    expect(await screen.findByRole('heading', { name: /Kafeterija Dorćol/ })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Venue sections' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Members1', 'Plan & modules', 'Billing notes', 'Activity', 'Danger zone']);
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveTextContent('Scans · 7 days');

    await typist.click(screen.getByRole('button', { name: 'Open as owner' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/r/${ids.restaurant}/menu`));
    expect(await screen.findByRole('heading', { name: 'Kafa' })).toBeInTheDocument();
    // The persistent banner, in Serbian, with the way back.
    const banner = screen.getByRole('status', { name: 'Open as owner' });
    expect(banner).toHaveTextContent('Prijavljen kao vlasnik lokala Kafeterija Dorćol');
    // The venue's requests carried the impersonation token, not the superadmin's own.
    const venueCalls = requests(spy).filter((r) => r.url.pathname === `/api/admin/restaurants/${ids.restaurant}`);
    expect(venueCalls.length).toBeGreaterThan(0);
    expect(venueCalls.every((r) => r.headers.get('Authorization') === `Bearer ${impersonation.token}`)).toBe(true);
    expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname === `/api/superadmin/restaurants/${ids.restaurant}/impersonate`)).toBe(true);

    await typist.click(within(banner).getByRole('button', { name: 'Nazad u admin' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${ids.restaurant}`));
    expect(await screen.findByRole('heading', { name: /Kafeterija Dorćol/ })).toBeInTheDocument();
    expect(screen.queryByText(/Prijavljen kao vlasnik/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('tabla.cms.impersonation')).toBeNull();
  });

  it('impersonates automatically when a superadmin opens a venue link directly', async () => {
    const spy = mockApi({ session: adminOnly() });
    renderApp(`/r/${ids.restaurant}/tables`);
    expect(await screen.findByText(/Prijavljen kao vlasnik lokala/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Tables & QR codes' })).toBeInTheDocument();
    expect(requests(spy).filter((r) => r.method === 'POST' && r.url.pathname.endsWith('/impersonate'))).toHaveLength(1);
    // "/" never sends a superadmin back into an impersonated venue.
    expect(localStorage.getItem(`tabla.cms.lastRestaurant.${ids.admin}`)).toBeNull();
  });

  it('serves the Users, Activity and System screens', async () => {
    mockApi({ session: adminOnly() });
    const { router } = renderApp('/admin/users');
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('No accounts yet.')).toBeInTheDocument();
    const typist = userEvent.setup();
    await typist.click(screen.getByRole('link', { name: 'Activity' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/activity'));
    expect(await screen.findByRole('option', { name: restaurant.name })).toBeInTheDocument();
    await typist.click(screen.getByRole('link', { name: 'System' }));
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('None — every register call went through.')).toBeInTheDocument();
  });
});
