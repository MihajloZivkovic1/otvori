import { describe, expect, it } from 'vitest';
import { outbox } from '../src/utils/mailer.js';
import { api, bearer, refreshCookie, registerUser, setCookies } from './helpers.js';

function tokenFromOutbox(): string {
  const message = outbox.at(-1);
  if (!message) throw new Error('outbox is empty');
  const match = message.text.match(/token=([^\s&]+)/);
  if (!match) throw new Error(`no token in mail: ${message.text}`);
  return decodeURIComponent(match[1]!);
}

describe('auth', () => {
  it('registers a user with a restaurant, owner membership and refresh cookie', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Ana',
      email: 'Ana@Example.com',
      password: 'secret123',
      restaurantName: 'Kafeterija Dorćol',
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.expiresIn).toBeGreaterThan(0);
    expect(res.body.user.email).toBe('ana@example.com');
    expect(res.body.user.hasPassword).toBe(true);
    expect(res.body.memberships).toHaveLength(1);
    expect(res.body.memberships[0].role).toBe('owner');
    expect(res.body.memberships[0].restaurant.slug).toBe('kafeterija-dorcol');
    expect(res.body.memberships[0].restaurant.status).toBe('trial');

    const cookie = setCookies(res).find((c) => c.startsWith('tabla_refresh='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('generates a unique slug when the restaurant name repeats', async () => {
    const first = await registerUser({ restaurantName: 'Caffe Nova' });
    const second = await registerUser({ restaurantName: 'Caffe Nova' });
    expect(first.memberships[0]!.restaurant.slug).toBe('caffe-nova');
    expect(second.memberships[0]!.restaurant.slug).toBe('caffe-nova-2');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await registerUser({ email: 'dup@example.com' });
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'X', email: 'DUP@example.com', password: 'secret123', restaurantName: 'Other' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns a consistent 400 shape for invalid bodies', async () => {
    const res = await api.post('/api/auth/register').send({ email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password', 'restaurantName']));
  });

  it('logs in, serves /me, and rejects bad credentials', async () => {
    const user = await registerUser();
    const login = await api.post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTypeOf('string');

    const me = await api.get('/api/auth/me').set(bearer(login.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.user.id);
    expect(me.body.memberships[0].restaurant.id).toBe(user.restaurantId);

    const wrong = await api.post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await api.post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(unknown.status).toBe(401);

    const noToken = await api.get('/api/auth/me');
    expect(noToken.status).toBe(401);
    const badToken = await api.get('/api/auth/me').set(bearer('garbage'));
    expect(badToken.status).toBe(401);
  });

  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const user = await registerUser();

    const first = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTypeOf('string');
    const rotated = refreshCookie(first);
    expect(rotated).not.toBe(user.cookie);

    // The old token is now used; presenting it again is reuse → everything is revoked.
    const reuse = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
    expect(reuse.status).toBe(401);
    const afterReuse = await api.post('/api/auth/refresh').set('Cookie', rotated);
    expect(afterReuse.status).toBe(401);

    const none = await api.post('/api/auth/refresh');
    expect(none.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    const user = await registerUser();
    const logout = await api.post('/api/auth/logout').set('Cookie', user.cookie);
    expect(logout.status).toBe(200);
    const refresh = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
    expect(refresh.status).toBe(401);
  });

  it('signs in with a one-time magic link', async () => {
    const user = await registerUser();

    const unknown = await api.post('/api/auth/magic-link').send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(outbox).toHaveLength(0);

    const known = await api.post('/api/auth/magic-link').send({ email: user.email });
    expect(known.status).toBe(200);
    expect(outbox).toHaveLength(1);
    const token = tokenFromOutbox();

    const consume = await api.get(`/api/auth/magic-link/${encodeURIComponent(token)}`);
    expect(consume.status).toBe(200);
    expect(consume.body.user.id).toBe(user.user.id);
    expect(refreshCookie(consume)).toBeTypeOf('string');

    const again = await api.get(`/api/auth/magic-link/${encodeURIComponent(token)}`);
    expect(again.status).toBe(401);
  });

  it('resets the password through the forgot-password flow', async () => {
    const user = await registerUser();
    const forgot = await api.post('/api/auth/forgot-password').send({ email: user.email });
    expect(forgot.status).toBe(200);
    const token = tokenFromOutbox();

    const reset = await api.post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' });
    expect(reset.status).toBe(200);
    expect(reset.body.accessToken).toBeTypeOf('string');

    const oldLogin = await api.post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api.post('/api/auth/login').send({ email: user.email, password: 'brand-new-pass' });
    expect(newLogin.status).toBe(200);

    // Previous refresh tokens are revoked by the password change.
    const oldRefresh = await api.post('/api/auth/refresh').set('Cookie', user.cookie);
    expect(oldRefresh.status).toBe(401);

    const reused = await api.post('/api/auth/reset-password').send({ token, password: 'another-pass-1' });
    expect(reused.status).toBe(401);
  });
});
