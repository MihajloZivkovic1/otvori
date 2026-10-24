import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, team, user } from './helpers';

const base = `/api/admin/restaurants/${ids.restaurant}`;

describe('team (Phase 11)', () => {
  it('lists members, invites by e-mail and generates a join code', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Team' });
    const members = within(card).getByRole('list', { name: 'Members' });
    expect(await within(members).findByText(user.name)).toBeInTheDocument();
    expect(within(members).getByText('Marko Konobar')).toBeInTheDocument();
    expect(within(members).getByText(/sign-in name from a join code/)).toBeInTheDocument();

    await typist.type(within(card).getByLabelText('E-mail address'), 'jelena@primer.rs');
    await typist.click(within(card).getByRole('button', { name: 'Invite' }));
    await waitFor(() => {
      const post = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === `${base}/team/invites`);
      expect(post?.body).toEqual({ email: 'jelena@primer.rs', role: 'staff' });
    });
    expect(await screen.findByText('Invite sent to jelena@primer.rs')).toBeInTheDocument();
    expect(within(within(card).getByRole('list', { name: 'Pending invites' })).getByText('jelena@primer.rs')).toBeInTheDocument();

    await typist.click(within(card).getByRole('button', { name: 'Generate join code' }));
    const joinCode = within(card).getByLabelText('Join code');
    expect(await within(joinCode).findByText('482913')).toBeInTheDocument();
    expect(within(joinCode).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('never offers to demote or remove the last owner', async () => {
    mockApi({ session: sessionFor(user) }, ({ url, method }) =>
      url.pathname === `${base}/team` && method === 'GET' ? { body: { ...team, members: [team.members[0]!] } } : undefined,
    );
    renderApp(`/r/${ids.restaurant}/settings`);
    const typist = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Team' });
    await typist.click(await within(card).findByRole('button', { name: `Actions for ${user.name}` }));
    expect(screen.getByRole('menuitem', { name: 'Make staff' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Leave venue' })).toBeDisabled();
  });

  it('creates a staff account from the join code on /join and signs the waiter in', async () => {
    const session = sessionFor({ ...user, id: '99999999-9999-4999-8999-999999999998', name: 'Pera Perić', email: 'pera.peric@kafeterija.staff.otvori.menu' });
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    const spy = mockApi({ session, refreshOk: false }, ({ url, method }) =>
      url.pathname === '/api/auth/join' && method === 'POST' ? { status: 201, body: session } : undefined,
    );
    renderApp('/join', { authenticated: false });
    const typist = userEvent.setup();
    await screen.findByRole('heading', { name: 'Join with a code' });
    await typist.type(screen.getByLabelText('Join code'), '482913');
    await typist.type(screen.getByLabelText('Your name'), 'Pera Perić');
    await typist.type(screen.getByLabelText('Password'), 'password123');
    await typist.click(screen.getByRole('button', { name: 'Create staff account' }));
    await waitFor(() => {
      const post = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === '/api/auth/join');
      expect(post?.body).toEqual({ code: '482913', name: 'Pera Perić', password: 'password123' });
    });
    expect(await screen.findByRole('heading', { name: 'Welcome to Kafeterija Dorćol' })).toBeInTheDocument();
    expect(screen.getByText(/pera\.peric@kafeterija\.staff\.otvori\.menu/)).toBeInTheDocument();
  });

  it('accepts an e-mail invite: preview, name, then the venue opens', async () => {
    const session = sessionFor({ ...user, id: '99999999-9999-4999-8999-999999999997', name: 'Jelena', email: 'jelena@primer.rs' });
    session.memberships = [{ ...session.memberships[0]!, role: 'staff' }];
    const spy = mockApi({ session, refreshOk: false }, ({ url, method }) => {
      if (url.pathname.startsWith('/api/auth/invite/') && method === 'GET') {
        return { body: { restaurantName: 'Kafeterija Dorćol', role: 'staff', email: 'jelena@primer.rs', existingUser: false } };
      }
      if (url.pathname === '/api/auth/invite' && method === 'POST') return { status: 201, body: session };
      return undefined;
    });
    renderApp('/auth/invite?token=abc123def456ghi789', { authenticated: false });
    const typist = userEvent.setup();
    await screen.findByRole('heading', { name: 'Join Kafeterija Dorćol' });
    await typist.type(screen.getByLabelText('Your name'), 'Jelena');
    await typist.click(screen.getByRole('button', { name: 'Create account & join' }));
    await waitFor(() => {
      const post = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === '/api/auth/invite');
      expect(post?.body).toEqual({ token: 'abc123def456ghi789', name: 'Jelena' });
    });
    expect(await screen.findByRole('switch', { name: 'Available: Espresso' })).toBeInTheDocument();
  });
});
