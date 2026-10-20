import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { menuRequests, mockFetch, renderMenu, serveFixtures } from './helpers';

describe('locale switching', () => {
  it('changes UI strings immediately and refetches the menu in the chosen locale', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu('/r/kafeterija?t=7');

    expect(await screen.findByText('Sto 7')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Kafa' })).toBeInTheDocument();
    expect(screen.getByText('Danas nije dostupno')).toBeInTheDocument();
    // Nothing requested → the restaurant default decides, no locale parameter.
    expect(menuRequests(fetchSpy)[0]?.url.searchParams.has('locale')).toBe(false);

    await user.click(screen.getByRole('button', { name: /Promeni jezik/ }));

    expect(await screen.findByText('Table 7')).toBeInTheDocument();
    expect(screen.getByText('Not available today')).toBeInTheDocument();
    await waitFor(() => expect(menuRequests(fetchSpy).at(-1)?.url.searchParams.get('locale')).toBe('en'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Coffee' })).toBeInTheDocument();
    expect(screen.getByText('Avocado toast')).toBeInTheDocument();
    expect(localStorage.getItem('tabla.lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('honours ?lang on first load and remembers it', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/r/kafeterija?lang=en');

    expect(await screen.findByRole('heading', { level: 2, name: 'Coffee' })).toBeInTheDocument();
    expect(menuRequests(fetchSpy)[0]?.url.searchParams.get('locale')).toBe('en');
    expect(screen.getByText('Not available today')).toBeInTheDocument();
    expect(screen.queryByText(/^Table \d+$/)).toBeNull(); // no ?t → no table chip
  });

  it('uses the remembered locale when the URL has none', async () => {
    localStorage.setItem('tabla.lang', 'en');
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/r/kafeterija');

    expect(await screen.findByRole('heading', { level: 2, name: 'Coffee' })).toBeInTheDocument();
    expect(menuRequests(fetchSpy)[0]?.url.searchParams.get('locale')).toBe('en');
  });
});
