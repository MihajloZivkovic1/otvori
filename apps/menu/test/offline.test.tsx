import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { menuSr, mockFetch, renderMenu } from './helpers';

describe('offline / empty screen', () => {
  it('renders the offline screen when the fetch fails and recovers on "Try again"', async () => {
    let failing = true;
    mockFetch(() => (failing ? new TypeError('Failed to fetch') : { body: menuSr }));
    const user = userEvent.setup();
    renderMenu();

    expect(await screen.findByRole('heading', { level: 1, name: 'Meni nije mogao da se učita' })).toBeInTheDocument();
    expect(
      screen.getByText('Proverite vezu i pokušajte ponovo. Cene i dostupnost zahtevaju internet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ili zatražite štampani meni od osoblja.')).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Pokušaj ponovo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Kafeterija Dorćol' })).toBeInTheDocument();
    expect(screen.getByText('Espresso')).toBeInTheDocument();
  });

  it('uses the not-published copy for a 404 MENU_NOT_PUBLISHED answer', async () => {
    mockFetch(() => ({
      status: 404,
      body: { error: { code: 'MENU_NOT_PUBLISHED', message: 'This menu is not published' } },
    }));
    renderMenu('/r/bar-savamala');

    expect(await screen.findByRole('heading', { level: 1, name: 'Meni nije mogao da se učita' })).toBeInTheDocument();
    expect(screen.getByText('Ovaj meni još nije objavljen. Pokušajte ponovo malo kasnije.')).toBeInTheDocument();
  });

  it('speaks English when the guest asked for it, even without restaurant data', async () => {
    mockFetch(() => new TypeError('Failed to fetch'));
    renderMenu('/r/kafeterija?lang=en');

    expect(await screen.findByRole('heading', { level: 1, name: "The menu couldn't load" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a branded header from the cached tenant while offline', async () => {
    localStorage.setItem(
      'tabla.tenant.kafeterija',
      JSON.stringify({ name: 'Kafeterija Dorćol', logoUrl: null, primaryColor: '#7A3E48', theme: 'dark' }),
    );
    mockFetch(() => new TypeError('Failed to fetch'));
    renderMenu();

    await screen.findByRole('heading', { level: 1, name: 'Meni nije mogao da se učita' });
    expect(screen.getByText('Kafeterija Dorćol')).toBeInTheDocument();
  });
});
