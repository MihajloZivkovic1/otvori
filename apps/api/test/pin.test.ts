import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/db/models/index.js';
import { resetPinLockouts } from '../src/modules/security/lockout.js';
import { outbox } from '../src/utils/mailer.js';
import { addStaff, api, bearer, createCategory, DEMO_PIN, login, registerUser, setPinAndUnlock } from './helpers.js';

describe('owner PIN (Phase 11)', () => {
  it('rejects trivial PINs and needs the password to set one', async () => {
    const owner = await registerUser();
    const url = `/api/admin/restaurants/${owner.restaurantId}/security/pin`;
    for (const pin of ['1234', '0000', '1111', '2580x', '123', '4321', '0123', '9876', '2000']) {
      const res = await api.put(url).set(bearer(owner.accessToken)).send({ pin, password: owner.password });
      expect(res.status, pin).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const wrongPassword = await api.put(url).set(bearer(owner.accessToken)).send({ pin: DEMO_PIN, password: 'not-my-password' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');

    const ok = await api.put(url).set(bearer(owner.accessToken)).send({ pin: DEMO_PIN, password: owner.password });
    expect(ok.status).toBe(200);
    expect(ok.body.pinSet).toBe(true);
    const restaurant = await api.get(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(owner.accessToken));
    expect(restaurant.body.pinSet).toBe(true);
    const actions = (await AuditLog.findAll({ where: { restaurantId: owner.restaurantId } })).map((r) => r.action);
    expect(actions).toContain('auth.pin_set');
  });

  it('gates owner actions on the elevation header once a PIN is set, and the token is bound to the sign-in', async () => {
    const owner = await registerUser();
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    // Before the PIN: the owner role alone is enough.
    expect((await api.post(`${base}/categories`).set(bearer(owner.accessToken)).send({ name: { sr: 'A' } })).status).toBe(201);

    const headers = await setPinAndUnlock(owner);
    const locked = await api.post(`${base}/categories`).set(bearer(owner.accessToken)).send({ name: { sr: 'B' } });
    expect(locked.status).toBe(403);
    expect(locked.body.error.code).toBe('PIN_REQUIRED');

    const garbage = await api.post(`${base}/categories`).set({ ...bearer(owner.accessToken), 'X-Elevation': 'nope' }).send({ name: { sr: 'B' } });
    expect(garbage.status).toBe(403);

    const unlocked = await api.post(`${base}/categories`).set(headers).send({ name: { sr: 'B' } });
    expect(unlocked.status).toBe(201);

    // Availability never asks for the PIN.
    const item = await api.post(`${base}/items`).set(headers).send({ categoryId: unlocked.body.id, name: { sr: 'Kafa' }, priceCents: 100 });
    const availability = await api.patch(`${base}/items/${item.body.id}/availability`).set(bearer(owner.accessToken)).send({ available: false });
    expect(availability.status).toBe(200);

    // The same elevation token presented from another sign-in of the same user is refused.
    const other = await login(owner.email, owner.password);
    const stolen = await api.post(`${base}/categories`).set({ ...bearer(other.accessToken), 'X-Elevation': headers['X-Elevation']! }).send({ name: { sr: 'C' } });
    expect(stolen.status).toBe(403);
    expect(stolen.body.error.code).toBe('PIN_REQUIRED');

    // A refresh keeps the session id, so the elevation survives token rotation.
    const refreshed = await api.post('/api/auth/refresh').set('Cookie', owner.cookie);
    expect(refreshed.status).toBe(200);
    const afterRefresh = await api.post(`${base}/categories`).set({ ...bearer(refreshed.body.accessToken), 'X-Elevation': headers['X-Elevation']! }).send({ name: { sr: 'D' } });
    expect(afterRefresh.status).toBe(201);
  });

  it('locks the session and the venue after 5 wrong PINs, logs it and mails the owners on the second lockout', async () => {
    const owner = await registerUser();
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    await api.put(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ pin: DEMO_PIN, password: owner.password });
    const attempt = (token: string, pin: string) => api.post(`${base}/security/unlock`).set(bearer(token)).send({ pin });

    for (let i = 1; i <= 4; i++) {
      const res = await attempt(owner.accessToken, '9517');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('PIN_INVALID');
      expect(res.body.error.details.attemptsLeft).toBe(5 - i);
    }
    const fifth = await attempt(owner.accessToken, '9517');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe('PIN_LOCKED');
    // Even the right PIN is refused while locked, from this session and from any other session of the venue.
    expect((await attempt(owner.accessToken, DEMO_PIN)).status).toBe(423);
    const other = await login(owner.email, owner.password);
    expect((await attempt(other.accessToken, DEMO_PIN)).status).toBe(423);
    const security = await api.get(`${base}/security`).set(bearer(owner.accessToken));
    expect(security.body.lockedUntil).not.toBeNull();

    const rows = await AuditLog.findAll({ where: { restaurantId: owner.restaurantId } });
    expect(rows.filter((r) => r.action === 'auth.pin_failed')).toHaveLength(5);
    expect(rows.filter((r) => r.action === 'auth.pin_lockout')).toHaveLength(1);
    expect(outbox.filter((m) => /PIN locked/.test(m.subject))).toHaveLength(0);

    // 15 minutes later (the counters are reset by hand), five more wrong PINs → second lockout → the owner is mailed.
    resetPinLockouts();
    for (let i = 0; i < 5; i++) await attempt(owner.accessToken, '9517');
    const alerts = outbox.filter((m) => /PIN locked/.test(m.subject));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.to).toBe(owner.email);
    expect(alerts[0]!.text).toContain(`/r/${owner.restaurantId}/settings/history`);
  });

  it('issues elevation after a password sign-in and lets the keypad unlock with the password too', async () => {
    const owner = await registerUser();
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    await api.put(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ pin: DEMO_PIN, password: owner.password });

    const session = await login(owner.email, owner.password);
    expect(session.elevations).toHaveLength(1);
    expect(session.elevations![0]!.restaurantId).toBe(owner.restaurantId);
    expect(session.elevations![0]!.window).toBe('5');
    const created = await api
      .post(`${base}/categories`)
      .set({ ...bearer(session.accessToken), 'X-Elevation': session.elevations![0]!.token })
      .send({ name: { sr: 'Posle prijave' } });
    expect(created.status).toBe(201);

    const byPassword = await api.post(`${base}/security/unlock`).set(bearer(session.accessToken)).send({ password: owner.password, window: 'session' });
    expect(byPassword.status).toBe(200);
    expect(byPassword.body.window).toBe('session');
    // `session` windows renew; a fixed window does not.
    const extended = await api.post(`${base}/security/extend`).set({ ...bearer(session.accessToken), 'X-Elevation': byPassword.body.token });
    expect(extended.status).toBe(200);
    const fixed = await api.post(`${base}/security/unlock`).set(bearer(session.accessToken)).send({ pin: DEMO_PIN, window: '1' });
    const notExtended = await api.post(`${base}/security/extend`).set({ ...bearer(session.accessToken), 'X-Elevation': fixed.body.token });
    expect(notExtended.status).toBe(403);

    // A venue without a PIN never hands out elevations and answers 409 to the keypad.
    const plain = await registerUser();
    const plainSession = await login(plain.email, plain.password);
    expect(plainSession.elevations).toBeUndefined();
    const noPin = await api.post(`/api/admin/restaurants/${plain.restaurantId}/security/unlock`).set(bearer(plainSession.accessToken)).send({ pin: DEMO_PIN });
    expect(noPin.status).toBe(409);
    expect(noPin.body.error.code).toBe('PIN_NOT_SET');
  });

  it('can be changed and removed with the password; staff cannot unlock at all', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const headers = await setPinAndUnlock(owner);

    const staffUnlock = await api.post(`${base}/security/unlock`).set(bearer(staff.accessToken)).send({ pin: DEMO_PIN });
    expect(staffUnlock.status).toBe(403);
    expect(staffUnlock.body.error.code).toBe('ROLE_REQUIRED');

    const changed = await api.put(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ pin: '7391', password: owner.password });
    expect(changed.status).toBe(200);
    const oldPin = await api.post(`${base}/security/unlock`).set(bearer(owner.accessToken)).send({ pin: DEMO_PIN });
    expect(oldPin.status).toBe(401);
    const newPin = await api.post(`${base}/security/unlock`).set(bearer(owner.accessToken)).send({ pin: '7391' });
    expect(newPin.status).toBe(200);

    const removed = await api.delete(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ password: owner.password });
    expect(removed.status).toBe(200);
    expect(removed.body.pinSet).toBe(false);
    // No PIN → the role alone is enough again, the old elevation header is simply ignored.
    expect((await createCategory(owner, { name: { sr: 'Bez PIN-a' } })).id).toBeTruthy();
    void headers;
    const actions = (await AuditLog.findAll({ where: { restaurantId: owner.restaurantId }, order: [['createdAt', 'ASC']] })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.pin_set', 'auth.pin_unlock', 'auth.pin_change', 'auth.pin_failed', 'auth.pin_remove']));
  });
});
