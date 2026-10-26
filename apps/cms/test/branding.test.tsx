import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RestaurantDto } from '@qr-menu/shared';
import { ids, mockApi, renderApp, requests, restaurant, sessionFor, user, type FetchHandler } from './helpers';

/** PATCH /restaurant echoes the merged branding like the API does. */
function venue(): FetchHandler {
  const current: RestaurantDto = { ...restaurant };
  return ({ url, method, body }) => {
    if (url.pathname !== `/api/admin/restaurants/${ids.restaurant}`) return undefined;
    if (method === 'GET') return { body: current };
    if (method === 'PATCH') {
      Object.assign(current, body as Partial<RestaurantDto>);
      return { body: current };
    }
    return undefined;
  };
}

describe('branding — background color', () => {
  it('offers the cream default, white and a hex field, previews the choice and saves it', async () => {
    const spy = mockApi({ session: sessionFor(user) }, venue());
    renderApp(`/r/${ids.restaurant}/branding`, { viewport: 'desktop' });
    await screen.findByRole('heading', { name: 'Branding' });

    const cream = screen.getByRole('radio', { name: 'Cream (default)' });
    expect(cream).toHaveAttribute('aria-checked', 'true');
    const preview = screen.getByLabelText('Live menu preview');
    expect(preview).toHaveStyle({ backgroundColor: '#F7F2EB' });

    await userEvent.click(screen.getByRole('radio', { name: 'White' }));
    expect(screen.getByLabelText('Background color hex')).toHaveValue('#FFFFFF');
    expect(preview).toHaveStyle({ backgroundColor: '#FFFFFF' });

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === `/api/admin/restaurants/${ids.restaurant}`);
      expect(patch?.body).toMatchObject({ backgroundColor: '#FFFFFF', primaryColor: '#7A3E48', theme: 'light' });
    });
  });

  it('rejects a dark page background (the light appearance keeps dark text)', async () => {
    const spy = mockApi({ session: sessionFor(user) }, venue());
    renderApp(`/r/${ids.restaurant}/branding`, { viewport: 'desktop' });
    await screen.findByRole('heading', { name: 'Branding' });

    const hex = screen.getByLabelText('Background color hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, '#1B1816');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a light color');
    expect(requests(spy).some((r) => r.method === 'PATCH')).toBe(false);
  });

  it('keeps the dark palette in the preview regardless of the background color', async () => {
    mockApi({ session: sessionFor(user) }, venue());
    renderApp(`/r/${ids.restaurant}/branding`, { viewport: 'desktop' });
    await screen.findByRole('heading', { name: 'Branding' });
    await userEvent.click(screen.getByRole('radio', { name: 'White' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByLabelText('Live menu preview')).toHaveStyle({ backgroundColor: '#1B1816' });
  });
});
