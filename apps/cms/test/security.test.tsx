import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AuditPageDto } from '@qr-menu/shared';
import { elevation, ids, mockApi, renderApp, requests, restaurant, restaurantWithPin, sessionFor, unlockDevice, user, type FetchHandler } from './helpers';

const PIN = '2580';
const base = `/api/admin/restaurants/${ids.restaurant}`;

/**
 * A venue with an owner PIN, behaving like the API: owner writes need `X-Elevation`, the keypad hands one out for
 * the right PIN and counts the wrong ones.
 */
function pinVenue(): FetchHandler {
  let attempts = 0;
  return ({ url, method, body, headers }) => {
    if (url.pathname === base && method === 'GET') return { body: restaurantWithPin };
    if (url.pathname === `${base}/security` && method === 'GET') return { body: { pinSet: true, dailyDigest: false, lockedUntil: null } };
    if (url.pathname === `${base}/security/unlock` && method === 'POST') {
      const input = body as { pin?: string; password?: string; window: string };
      if (input.pin === PIN || input.password === 'tabla1234') {
        return { body: { restaurantId: ids.restaurant, token: 'elev-fresh', expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), window: input.window } };
      }
      attempts += 1;
      return { status: 401, body: { error: { code: 'PIN_INVALID', message: 'Wrong PIN', details: { attemptsLeft: 5 - attempts } } } };
    }
    // Owner-level writes: refused without the elevation header.
    const ownerWrite = (url.pathname === base && method === 'PATCH') || (url.pathname === `${base}/items` && method === 'POST');
    if (ownerWrite && !headers.get('X-Elevation')) {
      return { status: 403, body: { error: { code: 'PIN_REQUIRED', message: 'Enter the owner PIN', details: { pinSet: true } } } };
    }
    if (url.pathname === base && method === 'PATCH') return { body: { ...restaurantWithPin, ...(body as object) } };
    return undefined;
  };
}

async function typePin(typist: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, pin: string) {
  for (const digit of pin) await typist.click(within(dialog).getByRole('button', { name: digit }));
}

describe('owner PIN (Phase 11)', () => {
  it('locks owner actions on a device: "Add item" opens the keypad, the right PIN unlocks and opens the editor', async () => {
    const spy = mockApi({ session: sessionFor(user) }, pinVenue());
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    expect(await screen.findByText('Locked')).toBeInTheDocument();
    await typist.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Owner PIN' });
    expect(screen.queryByRole('dialog', { name: 'New item' })).toBeNull();
    await typePin(typist, dialog, PIN);
    await waitFor(() => {
      const unlock = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === `${base}/security/unlock`);
      expect(unlock?.body).toEqual({ pin: PIN, window: '5' });
    });
    expect(await screen.findByRole('dialog', { name: 'New item' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Owner PIN' })).toBeNull();
    expect(screen.getByText(/^Unlocked · \d:\d\d$/)).toBeInTheDocument();
    expect(sessionStorage.getItem(`tabla.cms.elevation.${ids.restaurant}`)).toContain('elev-fresh');
  });

  it('replays a request the API refused with PIN_REQUIRED once the keypad succeeds', async () => {
    const spy = mockApi({ session: sessionFor(user) }, pinVenue());
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const city = await screen.findByLabelText('City');
    await typist.clear(city);
    await typist.type(city, 'Novi Sad');
    await typist.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Owner PIN' });
    await typePin(typist, dialog, PIN);
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    const patches = requests(spy).filter((r) => r.method === 'PATCH' && r.url.pathname === base);
    expect(patches).toHaveLength(2);
    expect(patches[0]!.headers.get('X-Elevation')).toBeNull();
    expect(patches[1]!.headers.get('X-Elevation')).toBe('elev-fresh');
    expect(patches[1]!.body).toMatchObject({ city: 'Novi Sad' });
  });

  it('shows the attempts left after a wrong PIN, and cancelling leaves the action undone', async () => {
    mockApi({ session: sessionFor(user) }, pinVenue());
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Owner PIN' });
    await typePin(typist, dialog, '1111');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wrong PIN — 4 attempts left');
    await typist.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('sends the elevation header while unlocked and "Lock" forgets it at once', async () => {
    unlockDevice();
    const spy = mockApi({ session: sessionFor(user) }, pinVenue());
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    expect(await screen.findByText(/^Unlocked · \d:\d\d$/)).toBeInTheDocument();
    const city = await screen.findByLabelText('City');
    await typist.type(city, 'x');
    await typist.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    const patch = requests(spy).find((r) => r.method === 'PATCH' && r.url.pathname === base);
    expect(patch?.headers.get('X-Elevation')).toBe(elevation.token);
    expect(screen.queryByRole('dialog')).toBeNull();

    await typist.click(screen.getByRole('button', { name: 'Lock' }));
    expect(await screen.findByText('Locked')).toBeInTheDocument();
    expect(sessionStorage.getItem(`tabla.cms.elevation.${ids.restaurant}`)).toBeNull();
  });

  it('keeps staff on service work: switches only, no editing, no PIN, no Protection / Team cards', async () => {
    const session = sessionFor(user);
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    mockApi({ session }, pinVenue());
    renderApp(`/r/${ids.restaurant}/menu`);
    await screen.findByRole('switch', { name: 'Available: Espresso' });
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit Espresso/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reorder/ })).toBeNull();
    expect(screen.queryByLabelText('New category')).toBeNull();
    expect(screen.queryByText('Locked')).toBeNull();
    expect(screen.getByText(/Staff can switch items on and off/)).toBeInTheDocument();
  });

  it('lets the owner set a PIN from Settings → Protection with the password', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Protection' });
    expect(await within(card).findByText(/Not set/)).toBeInTheDocument();
    await typist.click(within(card).getByRole('button', { name: 'Set PIN' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set an owner PIN' });
    await typist.type(within(dialog).getByLabelText('New PIN'), PIN);
    await typist.type(within(dialog).getByLabelText('Repeat PIN'), PIN);
    await typist.type(within(dialog).getByLabelText('Your password'), 'tabla1234');
    await typist.click(within(dialog).getByRole('button', { name: 'Set PIN' }));
    await waitFor(() => {
      const put = requests(spy).find((r) => r.method === 'PUT' && r.url.pathname === `${base}/security/pin`);
      expect(put?.body).toEqual({ pin: PIN, password: 'tabla1234' });
    });
    expect(await screen.findByText(/Owner PIN set/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Protection' })).getByText(/^Set ·/)).toBeInTheDocument();
  });

  it('refuses a trivial PIN before calling the API', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Set PIN' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set an owner PIN' });
    await typist.type(within(dialog).getByLabelText('New PIN'), '1234');
    await typist.type(within(dialog).getByLabelText('Repeat PIN'), '1234');
    await typist.type(within(dialog).getByLabelText('Your password'), 'tabla1234');
    await typist.click(within(dialog).getByRole('button', { name: 'Set PIN' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/most common/);
    expect(requests(spy).some((r) => r.url.pathname === `${base}/security/pin`)).toBe(false);
  });

  it('shows the change history with price changes highlighted and filters by kind', async () => {
    const page: AuditPageDto = {
      items: [
        {
          id: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
          action: 'item.update',
          user: { id: '99999999-9999-4999-8999-999999999998', name: 'Marko Konobar', email: 'marko@x' },
          role: 'owner',
          elevated: true,
          entityType: 'item',
          entityId: ids.espresso,
          entityLabel: 'Espresso',
          before: { priceCents: 18000 },
          after: { priceCents: 19000 },
          priceChange: true,
          ip: '10.0.0.7',
          createdAt: '2026-10-22T21:40:00.000Z',
        },
        {
          id: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
          action: 'auth.pin_failed',
          user: { id: ids.user, name: user.name, email: user.email },
          role: 'owner',
          elevated: false,
          entityType: null,
          entityId: null,
          entityLabel: null,
          before: null,
          after: { method: 'pin' },
          priceChange: false,
          ip: null,
          createdAt: '2026-10-22T21:35:00.000Z',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
      users: [{ id: ids.user, name: user.name }, { id: '99999999-9999-4999-8999-999999999998', name: 'Marko Konobar' }],
    };
    const spy = mockApi({ session: sessionFor(user) }, ({ url, method }) =>
      url.pathname === `${base}/audit-log` && method === 'GET' ? { body: url.searchParams.get('kind') === 'auth' ? { ...page, items: [page.items[1]!], total: 1 } : page } : undefined,
    );
    renderApp(`/r/${ids.restaurant}/settings/history`);
    const typist = userEvent.setup();
    await screen.findByRole('heading', { name: 'Change history' });
    const priceRow = (await screen.findByText(/edited item Espresso/)).closest('li')!;
    expect(priceRow).toHaveAttribute('data-price-change', 'true');
    expect(within(priceRow).getByText('Marko Konobar')).toBeInTheDocument();
    expect(within(priceRow).getByText('180 RSD → 190 RSD')).toBeInTheDocument();
    expect(screen.getByText(/entered a wrong PIN/)).toBeInTheDocument();

    await typist.click(screen.getByRole('tab', { name: 'Sign-ins & PIN' }));
    await waitFor(() => expect(screen.queryByText(/edited item Espresso/)).toBeNull());
    expect(requests(spy).some((r) => r.url.pathname === `${base}/audit-log` && r.url.searchParams.get('kind') === 'auth')).toBe(true);
    // The restaurant fixture has no PIN, so nothing in the shell says locked.
    expect(restaurant.pinSet).toBe(false);
  });
});
