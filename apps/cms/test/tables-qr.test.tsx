import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, user } from './helpers';

describe('tables → menu QR (no table)', () => {
  it('previews the venue QR and downloads PNG / the printable card', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    URL.createObjectURL = vi.fn(() => 'blob:qr');
    URL.revokeObjectURL = vi.fn();
    window.open = vi.fn(() => null) as unknown as typeof window.open;
    renderApp(`/r/${ids.restaurant}/tables`);
    const typist = userEvent.setup();

    await typist.click(await screen.findByRole('button', { name: 'Menu QR' }));
    const dialog = await screen.findByRole('dialog', { name: 'Menu QR code' });
    expect(await within(dialog).findByRole('img', { name: /Menu QR code for/ })).toHaveAttribute('src', 'blob:qr');
    expect(within(dialog).getByRole('link', { name: 'kafeterija.localhost:5174' })).toBeInTheDocument();
    await waitFor(() => expect(requests(spy).some((r) => r.url.pathname === `/api/admin/restaurants/${ids.restaurant}/qr.svg`)).toBe(true));

    await typist.click(within(dialog).getByRole('button', { name: 'PNG' }));
    await waitFor(() => expect(requests(spy).some((r) => r.url.pathname === `/api/admin/restaurants/${ids.restaurant}/qr.png`)).toBe(true));

    await typist.click(within(dialog).getByRole('button', { name: 'Print card' }));
    await waitFor(() => expect(requests(spy).some((r) => r.url.pathname === `/api/admin/restaurants/${ids.restaurant}/qr-card.pdf`)).toBe(true));
    expect(window.open).toHaveBeenCalled();

    await typist.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu QR code' })).not.toBeInTheDocument());
  });
});
