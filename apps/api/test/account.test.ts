import { describe, expect, it } from 'vitest';
import type { SessionDto } from '@qr-menu/shared';
import { AuditLog, User } from '../src/db/models/index.js';
import { api, bearer, login, refreshCookie, registerUser } from './helpers.js';

describe('account (Phase 13c)', () => {
  it('updates the profile; the e-mail needs the current password', async () => {
    const owner = await registerUser({ name: 'Ana' });
    const other = await registerUser();
    const renamed = await api.patch('/api/auth/me').set(bearer(owner.accessToken)).send({ name: 'Ana Petrović' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.user.name).toBe('Ana Petrović');

    const noPassword = await api.patch('/api/auth/me').set(bearer(owner.accessToken)).send({ email: 'ana@new.rs' });
    expect(noPassword.status).toBe(400);
    const wrong = await api.patch('/api/auth/me').set(bearer(owner.accessToken)).send({ email: 'ana@new.rs', currentPassword: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const taken = await api.patch('/api/auth/me').set(bearer(owner.accessToken)).send({ email: other.email, currentPassword: owner.password });
    expect(taken.status).toBe(409);
    const ok = await api.patch('/api/auth/me').set(bearer(owner.accessToken)).send({ email: 'ana@new.rs', currentPassword: owner.password });
    expect(ok.body.user.email).toBe('ana@new.rs');
    expect((await login('ana@new.rs', owner.password)).user.id).toBe(owner.user.id);
  });

  it('changes the password, signs other devices out and clears the must-change flag', async () => {
    const owner = await registerUser();
    await User.update({ mustChangePassword: true }, { where: { id: owner.user.id } });
    const phone = await login(owner.email, owner.password);
    expect(phone.user.mustChangePassword).toBe(true);

    const wrong = await api.post('/api/auth/change-password').set(bearer(owner.accessToken)).send({ currentPassword: 'wrong-wrong', newPassword: 'Brand-new-123' });
    expect(wrong.status).toBe(401);
    const same = await api.post('/api/auth/change-password').set(bearer(owner.accessToken)).send({ currentPassword: owner.password, newPassword: owner.password });
    expect(same.status).toBe(400);

    const changed = await api.post('/api/auth/change-password').set(bearer(owner.accessToken)).send({ currentPassword: owner.password, newPassword: 'Brand-new-123' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.accessToken).toBeTruthy();
    const freshCookie = refreshCookie(changed);

    // The phone's refresh token is dead, the fresh one works.
    const phoneRefresh = await api.post('/api/auth/refresh').set('Cookie', phone.cookie);
    expect(phoneRefresh.status).toBe(401);
    const mine = await api.post('/api/auth/refresh').set('Cookie', freshCookie);
    expect(mine.status).toBe(200);
    expect((await login(owner.email, 'Brand-new-123')).user.id).toBe(owner.user.id);
    const row = await AuditLog.findOne({ where: { action: 'auth.password_change' } });
    expect(row?.userId).toBe(owner.user.id);
    expect(row?.restaurantId).toBeNull();
  });

  it('lists devices with the current one marked and signs the others out', async () => {
    const owner = await registerUser();
    const laptop = await login(owner.email, owner.password);
    const phone = await api.post('/api/auth/login').set('User-Agent', 'Mozilla/5.0 (iPhone)').send({ email: owner.email, password: owner.password });
    expect(phone.status).toBe(200);

    const list = await api.get('/api/auth/sessions').set(bearer(laptop.accessToken));
    expect(list.status).toBe(200);
    const sessions = list.body as SessionDto[];
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(sessions.find((s) => s.userAgent === 'Mozilla/5.0 (iPhone)')).toBeTruthy();

    const revoked = await api.delete('/api/auth/sessions').set(bearer(laptop.accessToken));
    expect(revoked.status).toBe(200);
    expect(revoked.body).toHaveLength(1);
    expect((revoked.body as SessionDto[])[0]!.current).toBe(true);
    const phoneRefresh = await api.post('/api/auth/refresh').set('Cookie', refreshCookie(phone));
    expect(phoneRefresh.status).toBe(401);
    const laptopRefresh = await api.post('/api/auth/refresh').set('Cookie', laptop.cookie);
    expect(laptopRefresh.status).toBe(200);
  });

  it('is closed to "Open as owner" tokens', async () => {
    const admin = await registerUser({ restaurantName: 'HQ' });
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const imp = await api.post(`/api/superadmin/restaurants/${owner.restaurantId}/impersonate`).set(bearer(admin.accessToken));
    const sessions = await api.get('/api/auth/sessions').set(bearer(imp.body.token));
    expect(sessions.status).toBe(403);
    const change = await api.post('/api/auth/change-password').set(bearer(imp.body.token)).send({ currentPassword: admin.password, newPassword: 'Changed-123456' });
    expect(change.status).toBe(403);
  });
});
