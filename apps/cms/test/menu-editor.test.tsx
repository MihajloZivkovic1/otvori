import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, sessionFor, user } from './helpers';

describe('menu editor (desktop)', () => {
  it('renders categories and the selected category’s items from the API', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);

    const categoryList = await screen.findByRole('list', { name: 'Categories' });
    expect(within(categoryList).getByText('Kafa')).toBeInTheDocument();
    expect(within(categoryList).getByText('Doručak')).toBeInTheDocument();
    expect(within(categoryList).getByText('Sezonsko')).toBeInTheDocument();
    expect(within(categoryList).getByText('HIDDEN')).toBeInTheDocument();

    // First category is selected by default and its items are listed with prices and tags.
    expect(screen.getByRole('heading', { name: 'Kafa' })).toBeInTheDocument();
    expect(screen.getByText('2 items · 0 unavailable')).toBeInTheDocument();
    const rows = screen.getByRole('list', { name: 'Items' });
    expect(within(rows).getByText('Espresso')).toBeInTheDocument();
    expect(within(rows).getByText('Kapućino')).toBeInTheDocument();
    expect(within(rows).getByText('180 RSD')).toBeInTheDocument();
    expect(within(rows).getByText('New')).toBeInTheDocument();
    expect(within(rows).queryByText('Tost sa avokadom')).not.toBeInTheDocument();

    // Breadcrumb + publish status in the top bar.
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view live menu/i })).toHaveAttribute('href', 'http://kafeterija.localhost:5174');
  });

  it('switches the item list when another category is picked', async () => {
    mockApi({ session: sessionFor(user) });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`);
    const categoryList = await screen.findByRole('list', { name: 'Categories' });
    await userEvent.setup().click(within(categoryList).getByText('Doručak'));

    const rows = screen.getByRole('list', { name: 'Items' });
    expect(within(rows).getByText('Tost sa avokadom')).toBeInTheDocument();
    expect(screen.getByText('1 item · 1 unavailable')).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?c=${ids.breakfast}`);
    // Unavailable rows render their switch off.
    expect(screen.getByRole('switch', { name: 'Available: Tost sa avokadom' })).toHaveAttribute('aria-checked', 'false');
  });
});
