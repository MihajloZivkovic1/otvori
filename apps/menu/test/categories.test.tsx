import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { eventBodies, ids, MockIntersectionObserver, mockFetch, renderMenu, serveFixtures } from './helpers';

describe('category bar', () => {
  it('activates the chip of the category that scrolls under the bar', async () => {
    mockFetch(serveFixtures);
    renderMenu();

    const nav = await screen.findByRole('navigation', { name: 'Kategorije' });
    const chips = within(nav).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Kafa', 'Doručak']);
    expect(chips[0]).toHaveAttribute('aria-current', 'true');
    expect(chips[1]).not.toHaveAttribute('aria-current');

    const observer = MockIntersectionObserver.instances.find((instance) => instance.elements.size === 2);
    expect(observer).toBeDefined();
    const [coffee, breakfast] = Array.from(observer!.elements);
    expect(coffee).toHaveAttribute('data-category-id', ids.coffee);

    act(() => {
      observer!.trigger([
        { target: coffee!, isIntersecting: false },
        { target: breakfast!, isIntersecting: true },
      ]);
    });

    expect(chips[1]).toHaveAttribute('aria-current', 'true');
    expect(chips[0]).not.toHaveAttribute('aria-current');
  });

  it('scrolls to the category and activates the chip when it is tapped', async () => {
    mockFetch(serveFixtures);
    const user = userEvent.setup();
    renderMenu();

    const nav = await screen.findByRole('navigation', { name: 'Kategorije' });
    await user.click(within(nav).getByRole('button', { name: 'Doručak' }));

    expect(within(nav).getByRole('button', { name: 'Doručak' })).toHaveAttribute('aria-current', 'true');
    const section = document.getElementById(`cat-${ids.breakfast}`);
    expect(section?.scrollIntoView).toHaveBeenCalled();
  });

  it('shows the item count per category and posts one scan with the table number', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/r/kafeterija?t=7');

    expect(await screen.findByText('2 stavke')).toBeInTheDocument();
    expect(screen.getByText('1 stavka')).toBeInTheDocument();

    await waitFor(() => {
      expect(eventBodies(fetchSpy).filter((body) => body.type === 'scan')).toEqual([
        expect.objectContaining({ type: 'scan', tableNumber: 7, sessionId: expect.any(String) }),
      ]);
    });
    expect(sessionStorage.getItem('tabla.table.kafeterija')).toBe('7');
  });
});
