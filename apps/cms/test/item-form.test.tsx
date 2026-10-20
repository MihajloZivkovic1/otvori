import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, user } from './helpers';

describe('item drawer', () => {
  it('validates with the shared createItemSchema before sending anything', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Add item' }));

    const drawer = await screen.findByRole('dialog', { name: 'New item' });
    await typist.click(within(drawer).getByRole('button', { name: 'Save' }));

    // Messages come straight from the shared zod schema (name refine) and the price number check.
    expect(await within(drawer).findByText('At least one translation is required')).toBeInTheDocument();
    expect(within(drawer).getByText('Enter a price')).toBeInTheDocument();
    expect(requests(spy).some((r) => r.method === 'POST' && r.url.pathname.endsWith('/items'))).toBe(false);

    await typist.type(within(drawer).getByLabelText('Price'), 'abc');
    await typist.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(within(drawer).getByText('Enter a price')).toBeInTheDocument();
  });

  it('creates the item with name in the default locale, price in minor units and selected chips', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Add item' }));
    const drawer = await screen.findByRole('dialog', { name: 'New item' });

    await typist.type(within(drawer).getByLabelText('Name'), 'Latte');
    await typist.clear(within(drawer).getByLabelText('Price'));
    await typist.type(within(drawer).getByLabelText('Price'), '250,50');
    await typist.click(within(drawer).getByRole('button', { name: 'Milk' }));
    await typist.click(within(drawer).getByRole('button', { name: 'New' }));
    await typist.click(within(drawer).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = requests(spy).find((r) => r.method === 'POST' && r.url.pathname.endsWith('/items'));
      expect(post?.body).toMatchObject({
        categoryId: ids.coffee,
        name: { sr: 'Latte' },
        description: null,
        priceCents: 25050,
        allergens: ['M'],
        tags: ['new'],
        isAvailable: true,
        variants: [],
      });
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New item' })).not.toBeInTheDocument());
  });

  it('asks before discarding unsaved changes', async () => {
    mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Add item' }));
    const drawer = await screen.findByRole('dialog', { name: 'New item' });
    await typist.type(within(drawer).getByLabelText('Name'), 'Draft');
    await typist.click(within(drawer).getByRole('button', { name: 'Cancel' }));

    const confirm = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await typist.click(within(confirm).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New item' })).not.toBeInTheDocument());
  });
});
