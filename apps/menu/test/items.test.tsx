import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { eventBodies, ids, mockFetch, renderMenu, serveFixtures } from './helpers';

describe('menu items', () => {
  it('renders unavailable items dimmed, without a button, and never opens the sheet for them', async () => {
    mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu();

    const label = await screen.findByText('Danas nije dostupno');
    const row = label.closest('li');
    expect(row).not.toBeNull();
    expect(within(row!).queryByRole('button')).toBeNull();
    expect(row!.firstElementChild).toHaveAttribute('aria-disabled', 'true');
    expect(row!.firstElementChild?.className).toContain('opacity-45');

    await user.click(within(row!).getByText('Tost sa avokadom'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows "od" + the lowest variant price for items with variants', async () => {
    mockFetch(serveFixtures);
    renderMenu();

    const row = (await screen.findByText('Espresso')).closest('li')!;
    expect(within(row).getByText('od 180 RSD')).toBeInTheDocument();
    const cappuccino = screen.getByText('Kapućino').closest('li')!;
    expect(within(cappuccino).getByText('250 RSD')).toBeInTheDocument();
    expect(within(cappuccino).getByRole('img', { name: 'Mleko' })).toBeInTheDocument();
    expect(within(cappuccino).getByText('Novo')).toBeInTheDocument();
  });

  it('opens the detail sheet, reports an item_view, traps focus and closes with Escape', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu();

    const opener = await screen.findByRole('button', { name: /Espresso/ });
    await user.click(opener);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Espresso' })).toBeInTheDocument();
    expect(within(dialog).getByText('Veličina')).toBeInTheDocument();
    expect(within(dialog).getByText('Double')).toBeInTheDocument();
    expect(within(dialog).getByText('220 RSD')).toBeInTheDocument();
    expect(within(dialog).getByText('Bez deklarisanih alergena')).toBeInTheDocument();
    expect(document.body.style.position).toBe('fixed');

    await waitFor(() => {
      expect(eventBodies(fetchSpy)).toContainEqual(
        expect.objectContaining({ type: 'item_view', itemId: ids.espresso }),
      );
    });

    // Tab cycles inside the dialog: the only focusable element is the Close button.
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Zatvori' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Zatvori' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.position).toBe('');
    expect(opener).toHaveFocus();
  });

  it('lists allergens as full words in the sheet', async () => {
    mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu();

    await user.click(await screen.findByRole('button', { name: /Kapućino/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Mleko')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zatvori' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('filters items with the inline search (diacritic-insensitive)', async () => {
    mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu();

    await screen.findByText('Espresso');
    await user.click(screen.getByRole('button', { name: 'Pretraga' }));
    await user.type(screen.getByRole('searchbox'), 'kapuc');

    expect(screen.getByText('Kapućino')).toBeInTheDocument();
    expect(screen.queryByText('Espresso')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Doručak' })).toBeNull();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'xyz');
    expect(screen.getByText('Nijedna stavka ne odgovara pretrazi.')).toBeInTheDocument();
  });
});
