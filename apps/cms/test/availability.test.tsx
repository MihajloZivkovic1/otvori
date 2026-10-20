import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, statefulItems, user } from './helpers';

describe('availability switch', () => {
  it('flips optimistically and sends PATCH /availability', async () => {
    const spy = mockApi({ session: sessionFor(user) }, statefulItems());
    renderApp(`/r/${ids.restaurant}/menu`);
    const toggle = await screen.findByRole('switch', { name: 'Available: Espresso' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.setup().click(toggle);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Available: Espresso' })).toHaveAttribute('aria-checked', 'false'));

    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname.endsWith(`/items/${ids.espresso}/availability`));
      expect(patch?.body).toEqual({ available: false });
    });
    // Still off after the refetch that follows the mutation.
    await waitFor(() => expect(requests(spy).filter((r) => r.method === 'GET' && r.url.pathname.endsWith('/items')).length).toBeGreaterThan(1));
    expect(screen.getByRole('switch', { name: 'Available: Espresso' })).toHaveAttribute('aria-checked', 'false');
  });

  it('rolls back when the API rejects the change', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi({ session: sessionFor(user) }, async (request) => {
      if (request.method === 'PATCH' && request.url.pathname.endsWith('/availability')) {
        await gate;
        return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } } };
      }
      return undefined;
    });
    renderApp(`/r/${ids.restaurant}/menu`);
    const toggle = await screen.findByRole('switch', { name: 'Available: Espresso' });

    await userEvent.setup().click(toggle);
    // Optimistic: off before the server has answered…
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Available: Espresso' })).toHaveAttribute('aria-checked', 'false'));

    release!();
    // …and back on once the error arrives, with a toast.
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Available: Espresso' })).toHaveAttribute('aria-checked', 'true'));
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
  });
});
