import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MembershipDto, RestaurantDto } from '@qr-menu/shared';
import { ids, membership, mockApi, renderApp, requests, restaurant, sessionFor, user } from './helpers';

const NEW_ID = '12341234-1234-4123-8123-123412341234';
const newVenue: RestaurantDto = {
  ...restaurant,
  id: NEW_ID,
  name: 'Bistro Zemun',
  slug: 'bistro-zemun',
  city: null,
  plan: 'trial',
  status: 'trial',
  publishedAt: null,
};
const newMembership: MembershipDto = {
  id: '56785678-5678-4678-8678-567856785678',
  role: 'owner',
  restaurant: {
    id: NEW_ID,
    slug: newVenue.slug,
    name: newVenue.name,
    city: null,
    logoUrl: null,
    primaryColor: restaurant.primaryColor,
    status: 'trial',
    plan: 'trial',
    publishedAt: null,
  },
};

describe('adding a venue', () => {
  it('lets a Pro owner create one from the switcher and opens its empty menu', async () => {
    let created = false;
    const spy = mockApi({ session: sessionFor(user) }, ({ url, method }) => {
      if (url.pathname === '/api/admin/restaurants' && method === 'POST') {
        created = true;
        return { status: 201, body: newVenue };
      }
      if (url.pathname === '/api/auth/me' && created) return { body: { user, memberships: [membership, newMembership] } };
      if (url.pathname === `/api/admin/restaurants/${NEW_ID}` && method === 'GET') return { body: newVenue };
      if (url.pathname.startsWith(`/api/admin/restaurants/${NEW_ID}/`)) return { body: [] };
      return undefined;
    });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });

    const typist = userEvent.setup();
    await typist.click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    expect(within(menu).getByText('Beograd')).toBeInTheDocument();
    await typist.click(within(menu).getByRole('menuitem', { name: /Add a venue/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Add a venue' });
    await typist.type(within(dialog).getByLabelText('Restaurant name'), 'Bistro Zemun');
    await typist.click(within(dialog).getByRole('button', { name: 'Create venue' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/r/${NEW_ID}/menu`));
    const post = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === '/api/admin/restaurants');
    expect(post?.body).toEqual({ name: 'Bistro Zemun' });
    expect(await screen.findByRole('button', { name: /Bistro Zemun/ })).toBeInTheDocument();
  });

  it('shows the Pro hint to owners on other plans', async () => {
    const trialMembership: MembershipDto = { ...membership, restaurant: { ...membership.restaurant, plan: 'trial', status: 'trial' } };
    mockApi({ session: { ...sessionFor(user), memberships: [trialMembership] } });
    renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });

    await userEvent.setup().click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    const row = within(menu).getByRole('menuitem', { name: /Add a venue/ });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(within(row).getByText('Available on Pro')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
