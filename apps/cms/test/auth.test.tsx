import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ids, mockApi, renderApp, requests, sessionFor, user } from './helpers';

describe('auth', () => {
  it('sends signed-out visitors to /login and returns them to the requested page after signing in', async () => {
    const spy = mockApi({ session: sessionFor(user) });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`, { authenticated: false });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    // No silent refresh without "remember me" or an open tab session.
    expect(requests(spy).some((r) => r.url.pathname === '/api/auth/refresh')).toBe(false);

    const typist = userEvent.setup();
    await typist.type(screen.getByLabelText('Email'), 'ana@kafeterija.rs');
    await typist.type(screen.getByLabelText('Password'), 'tabla1234');
    await typist.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Kafa' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/r/${ids.restaurant}/menu`);
    const login = requests(spy).find((r) => r.url.pathname === '/api/auth/login');
    expect(login?.body).toEqual({ email: 'ana@kafeterija.rs', password: 'tabla1234' });
    // The protected calls carry the access token from the login response.
    const categories = requests(spy).find((r) => r.url.pathname.endsWith('/categories'));
    expect(categories?.headers.get('authorization')).toBe('Bearer token-1');
  });

  it('refreshes the access token once after a 401 and retries the request', async () => {
    let refreshes = 0;
    const spy = mockApi({ session: sessionFor(user) }, (request) => {
      if (request.url.pathname === '/api/auth/refresh') {
        refreshes += 1;
        return { body: sessionFor(user, `token-${refreshes}`) };
      }
      if (request.url.pathname.endsWith('/categories') && request.headers.get('authorization') === 'Bearer token-1') {
        return { status: 401, body: { error: { code: 'TOKEN_EXPIRED', message: 'Token expired' } } };
      }
      return undefined;
    });
    renderApp(`/r/${ids.restaurant}/menu`);

    expect(await screen.findByRole('heading', { name: 'Kafa' })).toBeInTheDocument();
    const categoryCalls = requests(spy).filter((r) => r.url.pathname.endsWith('/categories'));
    expect(categoryCalls.map((r) => r.headers.get('authorization'))).toEqual(['Bearer token-1', 'Bearer token-2']);
    expect(refreshes).toBe(2); // session restore + the retry
  });

  it('falls back to /login when the refresh token is gone', async () => {
    mockApi({ session: sessionFor(user), refreshOk: false });
    const { router } = renderApp(`/r/${ids.restaurant}/menu`);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
