import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, statefulItems, user } from './helpers';

describe('Unavailable today (mobile)', () => {
  it('switches an item off until 06:00 tomorrow and back on', async () => {
    const spy = mockApi({ session: sessionFor(user) }, statefulItems());
    renderApp(`/r/${ids.restaurant}/menu/unavailable`, { viewport: 'mobile' });
    const typist = userEvent.setup();

    expect(await screen.findByText('1 off today')).toBeInTheDocument();
    expect(screen.getByText('Everything comes back at 06:00.')).toBeInTheDocument();
    // Hidden categories are not listed; the unavailable item shows its status.
    expect(screen.queryByText('Sezonsko')).not.toBeInTheDocument();
    expect(screen.getByText('Off today')).toBeInTheDocument();

    await typist.click(screen.getByRole('switch', { name: 'Espresso' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/items/${ids.espresso}/availability`));
      expect(patch?.body).toEqual({ available: false, until: 'tomorrow-06:00' });
    });
    await waitFor(() => expect(screen.getByText('2 off today')).toBeInTheDocument());

    await typist.click(screen.getByRole('switch', { name: 'Tost sa avokadom' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/items/${ids.avocado}/availability`));
      expect(patch?.body).toEqual({ available: true });
    });
  });

  it('shows the bottom tab bar instead of the sidebar on phones', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu/unavailable`, { viewport: 'mobile' });
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });
});
