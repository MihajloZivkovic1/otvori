import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, sessionFor, superadmin, user } from './helpers';

describe('superadmin navigation', () => {
  it('hides "All restaurants" from regular owners', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });
    await userEvent.setup().click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    expect(within(menu).getByRole('menuitem', { name: /Kafeterija Dorćol/ })).toBeInTheDocument();
    expect(within(menu).queryByText('All restaurants')).not.toBeInTheDocument();
    expect(within(menu).queryByText('SUPERADMIN')).not.toBeInTheDocument();
  });

  it('shows it, with the SUPERADMIN badge, to superadmins and opens the list', async () => {
    mockApi({ session: sessionFor(superadmin) });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('heading', { name: 'Kafa' });
    const typist = userEvent.setup();
    await typist.click(screen.getByRole('button', { name: /Kafeterija Dorćol/ }));
    const menu = await screen.findByRole('menu', { name: 'Your venues' });
    const link = within(menu).getByRole('menuitem', { name: /All restaurants/ });
    expect(within(link).getByText('SUPERADMIN')).toBeInTheDocument();

    await typist.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin'));
    expect(await screen.findByRole('heading', { name: 'All restaurants' })).toBeInTheDocument();
    expect(await screen.findByText('Beograd')).toBeInTheDocument();
  });

  it('keeps the /superadmin route away from non-superadmins', async () => {
    mockApi({ session: sessionFor(user) });
    const { router } = renderApp('/superadmin');
    await screen.findByRole('heading', { name: 'Kafa' });
    expect(router.state.location.pathname).toBe(`/r/${ids.restaurant}/menu`);
  });
});
