import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import type {
  ImpersonationDto,
  SuperadminActivityPageDto,
  SuperadminRestaurantDetailDto,
  SuperadminRestaurantDto,
  SuperadminUserDto,
  SystemStatusDto,
} from '@qr-menu/shared';
import { AuditLog, Restaurant, User } from '../src/db/models/index.js';
import { outbox } from '../src/utils/mailer.js';
import { api, bearer, login, registerUser, type RegisteredUser } from './helpers.js';

async function superadmin(): Promise<RegisteredUser> {
  const admin = await registerUser({ restaurantName: 'HQ', email: `admin-${Date.now()}@otvori.menu` });
  await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });
  return admin;
}

describe('impersonation ("Open as owner")', () => {
  it('issues a venue-scoped, short-lived token to superadmins and logs it', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const other = await registerUser({ restaurantName: 'Druga' });

    const res = await api.post(`/api/superadmin/restaurants/${owner.restaurantId}/impersonate`).set(bearer(admin.accessToken));
    expect(res.status).toBe(201);
    const imp = res.body as ImpersonationDto;
    expect(imp.restaurant).toMatchObject({ id: owner.restaurantId, name: 'Kafeterija' });
    expect(imp.owner?.email).toBe(owner.email);
    expect(new Date(imp.expiresAt).getTime() - Date.now()).toBeGreaterThan(50 * 60_000);
    expect(new Date(imp.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(60 * 60_000);

    // Full owner rights on that venue, no PIN, no owner password involved …
    const patch = await api.patch(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(imp.token)).send({ tagline: 'Via impersonation' });
    expect(patch.status).toBe(200);
    expect(patch.body.tagline).toBe('Via impersonation');
    // … and nothing else: another venue, the superadmin API, all refused.
    const scope = await api.get(`/api/admin/restaurants/${other.restaurantId}`).set(bearer(imp.token));
    expect(scope.status).toBe(403);
    expect(scope.body.error.code).toBe('IMPERSONATION_SCOPE');
    const adminApi = await api.get('/api/superadmin/restaurants').set(bearer(imp.token));
    expect(adminApi.status).toBe(403);

    // The audit log names the superadmin, not the owner.
    const rows = await AuditLog.findAll({ where: { restaurantId: owner.restaurantId, action: 'auth.impersonate' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(admin.user.id);
    expect(rows[0]!.role).toBe('superadmin');
    const change = await AuditLog.findOne({ where: { restaurantId: owner.restaurantId, action: 'restaurant.update' } });
    expect(change?.userId).toBe(admin.user.id);
    expect(change?.role).toBe('superadmin');

    // The owner's own session still works and the password was never touched.
    const again = await login(owner.email, owner.password);
    expect(again.user.id).toBe(owner.user.id);
  });

  it('is impossible for owners and staff, and an expired token is refused', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const denied = await api.post(`/api/superadmin/restaurants/${owner.restaurantId}/impersonate`).set(bearer(owner.accessToken));
    expect(denied.status).toBe(403);

    const admin = await superadmin();
    const expired = jwt.sign({ type: 'access', imp: owner.restaurantId, sid: 'imp-x' }, 'test-only-secret-not-for-production', {
      algorithm: 'HS256',
      subject: admin.user.id,
      issuer: 'tabla',
      expiresIn: -10,
    });
    const res = await api.get(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');

    // A token forged for a non-superadmin subject is worthless even if correctly signed.
    const forged = jwt.sign({ type: 'access', imp: owner.restaurantId, sid: 'imp-y' }, 'test-only-secret-not-for-production', {
      algorithm: 'HS256',
      subject: owner.user.id,
      issuer: 'tabla',
      expiresIn: 60,
    });
    const forgedRes = await api.get(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(forged));
    expect(forgedRes.status).toBe(401);
  });
});

describe('superadmin restaurants', () => {
  it('lists with owner, last scan, filters, search by owner e-mail and sorting', async () => {
    const admin = await superadmin();
    const a = await registerUser({ restaurantName: 'Alfa', email: `alfa-${Date.now()}@x.rs` });
    const b = await registerUser({ restaurantName: 'Beta', email: `beta-${Date.now()}@x.rs` });
    await Restaurant.update({ status: 'active', plan: 'pro', modules: { ordering: true, payments: false, pos: false } }, { where: { id: b.restaurantId } });

    const all = await api.get('/api/superadmin/restaurants?sort=name&dir=asc').set(bearer(admin.accessToken));
    expect(all.status).toBe(200);
    const names = (all.body.items as SuperadminRestaurantDto[]).map((r) => r.name);
    expect(names.indexOf('Alfa')).toBeLessThan(names.indexOf('Beta'));
    const alfa = (all.body.items as SuperadminRestaurantDto[]).find((r) => r.id === a.restaurantId)!;
    expect(alfa.owner?.email).toBe(a.email);
    expect(alfa.lastScanAt).toBeNull();
    expect(alfa.paidUntil).toBeNull();
    expect(alfa.onboardingStep).toBeNull();

    const byOwner = await api.get(`/api/superadmin/restaurants?search=${encodeURIComponent(b.email)}`).set(bearer(admin.accessToken));
    expect((byOwner.body.items as SuperadminRestaurantDto[]).map((r) => r.id)).toEqual([b.restaurantId]);

    const byModule = await api.get('/api/superadmin/restaurants?module=ordering').set(bearer(admin.accessToken));
    expect((byModule.body.items as SuperadminRestaurantDto[]).map((r) => r.id)).toEqual([b.restaurantId]);

    const byPlan = await api.get('/api/superadmin/restaurants?plan=pro&status=active').set(bearer(admin.accessToken));
    expect((byPlan.body.items as SuperadminRestaurantDto[]).map((r) => r.id)).toEqual([b.restaurantId]);

    const bad = await api.get('/api/superadmin/restaurants?sort=nope').set(bearer(admin.accessToken));
    expect(bad.status).toBe(400);
  });

  it('shows the detail, updates billing/plan/venue fields and deletes with a platform-level audit row', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const base = `/api/superadmin/restaurants/${owner.restaurantId}`;

    const detail = await api.get(base).set(bearer(admin.accessToken));
    expect(detail.status).toBe(200);
    const dto = detail.body as SuperadminRestaurantDetailDto;
    expect(dto.members).toHaveLength(1);
    expect(dto.members[0]).toMatchObject({ email: owner.email, role: 'owner', hasPassword: true, mustChangePassword: false });
    expect(dto.cmsUrl).toContain(`/r/${owner.restaurantId}`);
    expect(dto.publicUrl).toBe('http://kafeterija.localhost:5174');

    const updated = await api
      .patch(base)
      .set(bearer(admin.accessToken))
      .send({ status: 'active', plan: 'starter', billingNote: 'Yearly, invoice to Pera', paidUntil: '2027-01-31', adminNotes: 'Owner prefers Viber', city: 'Niš', slug: 'kafeterija-nis' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ status: 'active', plan: 'starter', billingNote: 'Yearly, invoice to Pera', paidUntil: '2027-01-31', adminNotes: 'Owner prefers Viber', city: 'Niš', slug: 'kafeterija-nis' });

    const taken = await registerUser({ restaurantName: 'Zauzeto' });
    const conflict = await api.patch(base).set(bearer(admin.accessToken)).send({ slug: 'zauzeto' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('SLUG_TAKEN');
    void taken;

    const audit = await AuditLog.findOne({ where: { restaurantId: owner.restaurantId, action: 'admin.restaurant_update' } });
    expect(audit?.after).toMatchObject({ plan: 'starter', paidUntil: '2027-01-31' });
    expect(audit?.role).toBe('superadmin');

    const del = await api.delete(base).set(bearer(admin.accessToken));
    expect(del.status).toBe(204);
    expect(await Restaurant.findByPk(owner.restaurantId)).toBeNull();
    const trace = await AuditLog.findOne({ where: { action: 'admin.restaurant_delete' } });
    expect(trace?.restaurantId).toBeNull();
    expect(trace?.entityLabel).toBe('Kafeterija');

    const ownerDenied = await api.get(base).set(bearer(owner.accessToken));
    expect(ownerDenied.status).toBe(403);
  });
});

describe('superadmin members', () => {
  it('attaches an existing account or creates one, changes roles and protects the last owner', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const existing = await registerUser({ restaurantName: 'Elsewhere' });
    const base = `/api/superadmin/restaurants/${owner.restaurantId}/members`;

    const attached = await api.post(base).set(bearer(admin.accessToken)).send({ email: existing.email, role: 'staff' });
    expect(attached.status).toBe(201);
    expect(attached.body.created).toBe(false);
    expect(attached.body.member).toMatchObject({ userId: existing.user.id, role: 'staff' });

    const dup = await api.post(base).set(bearer(admin.accessToken)).send({ email: existing.email, role: 'staff' });
    expect(dup.status).toBe(409);

    const incomplete = await api.post(base).set(bearer(admin.accessToken)).send({ email: 'new@x.rs', role: 'owner' });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error.code).toBe('VALIDATION_ERROR');

    const created = await api
      .post(base)
      .set(bearer(admin.accessToken))
      .send({ email: 'new@x.rs', role: 'owner', name: 'Nova Vlasnica', password: 'Lozinka12345', mustChangePassword: true, phone: '+381 60 123 456' });
    expect(created.status).toBe(201);
    expect(created.body.created).toBe(true);
    expect(created.body.member).toMatchObject({ email: 'new@x.rs', role: 'owner', mustChangePassword: true, phone: '+381 60 123 456', hasPassword: true });
    expect(created.body.members).toHaveLength(3);

    // The new owner can sign in with the admin-typed password and is told to change it.
    const session = await login('new@x.rs', 'Lozinka12345');
    expect(session.user.mustChangePassword).toBe(true);

    const membershipId = created.body.member.membershipId as string;
    const demoted = await api.patch(`${base}/${membershipId}`).set(bearer(admin.accessToken)).send({ role: 'staff' });
    expect(demoted.status).toBe(200);
    const originalOwner = (demoted.body as { membershipId: string; userId: string }[]).find((m) => m.userId === owner.user.id)!;
    const lastOwner = await api.patch(`${base}/${originalOwner.membershipId}`).set(bearer(admin.accessToken)).send({ role: 'staff' });
    expect(lastOwner.status).toBe(409);
    expect(lastOwner.body.error.code).toBe('LAST_OWNER');

    const removed = await api.delete(`${base}/${membershipId}`).set(bearer(admin.accessToken));
    expect(removed.status).toBe(200);
    expect(removed.body).toHaveLength(2);

    const invited = await api.post(`/api/superadmin/restaurants/${owner.restaurantId}/invites`).set(bearer(admin.accessToken)).send({ email: 'konobar@x.rs' });
    expect(invited.status).toBe(201);
    expect(invited.body[0].email).toBe('konobar@x.rs');
    expect(outbox.find((m) => m.to === 'konobar@x.rs')).toBeTruthy();
  });
});

describe('superadmin users', () => {
  it('lists, searches, sends reset/magic links, sets passwords and deactivates accounts', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija', name: 'Ana Petrović' });

    const list = await api.get(`/api/superadmin/users?search=${encodeURIComponent('petrov')}`).set(bearer(admin.accessToken));
    expect(list.status).toBe(200);
    const rows = list.body.items as SuperadminUserDto[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: owner.email, isSuperadmin: false, hasRealEmail: true });
    expect(rows[0]!.memberships[0]).toMatchObject({ role: 'owner', restaurant: { name: 'Kafeterija' } });
    expect(rows[0]!.lastLoginAt).toBeNull();

    outbox.length = 0;
    const reset = await api.post(`/api/superadmin/users/${owner.user.id}/reset-password`).set(bearer(admin.accessToken));
    expect(reset.status).toBe(200);
    expect(reset.body.mailed).toBe(true);
    expect(reset.body.url).toContain('/auth/reset?token=');
    expect(outbox[0]?.text).toContain(reset.body.url);
    const token = new URL(reset.body.url).searchParams.get('token')!;
    const used = await api.post('/api/auth/reset-password').send({ token, password: 'NewPassword123' });
    expect(used.status).toBe(200);

    const magic = await api.post(`/api/superadmin/users/${owner.user.id}/magic-link`).set(bearer(admin.accessToken));
    expect(magic.status).toBe(200);
    expect(magic.body.url).toContain('/auth/magic?token=');

    const set = await api.post(`/api/superadmin/users/${owner.user.id}/password`).set(bearer(admin.accessToken)).send({ password: 'AdminSet12345' });
    expect(set.status).toBe(200);
    expect(set.body.mustChangePassword).toBe(true);
    const signedIn = await login(owner.email, 'AdminSet12345');
    expect(signedIn.user.mustChangePassword).toBe(true);

    const self = await api.post(`/api/superadmin/users/${admin.user.id}/deactivate`).set(bearer(admin.accessToken));
    expect(self.status).toBe(409);

    const off = await api.post(`/api/superadmin/users/${owner.user.id}/deactivate`).set(bearer(admin.accessToken));
    expect(off.status).toBe(200);
    expect(off.body.deactivatedAt).not.toBeNull();
    const refused = await api.get('/api/auth/me').set(bearer(signedIn.accessToken));
    expect(refused.status).toBe(401);
    expect(refused.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    const loginRefused = await api.post('/api/auth/login').send({ email: owner.email, password: 'AdminSet12345' });
    expect(loginRefused.status).toBe(401);
    expect(loginRefused.body.error.code).toBe('ACCOUNT_DEACTIVATED');

    const on = await api.post(`/api/superadmin/users/${owner.user.id}/activate`).set(bearer(admin.accessToken));
    expect(on.body.deactivatedAt).toBeNull();
    const back = await login(owner.email, 'AdminSet12345');
    expect(back.user.id).toBe(owner.user.id);
    const relisted = await api.get(`/api/superadmin/users/${owner.user.id}`).set(bearer(admin.accessToken));
    expect(relisted.body.lastLoginAt).not.toBeNull();

    const lastAdmin = await api.patch(`/api/superadmin/users/${admin.user.id}`).set(bearer(admin.accessToken)).send({ isSuperadmin: false });
    expect(lastAdmin.status).toBe(409);
    const renamed = await api.patch(`/api/superadmin/users/${owner.user.id}`).set(bearer(admin.accessToken)).send({ name: 'Ana P.', phone: '+381601234567' });
    expect(renamed.body).toMatchObject({ name: 'Ana P.', phone: '+381601234567' });
    const row = await AuditLog.findOne({ where: { action: 'admin.user_deactivate' } });
    expect(row?.restaurantId).toBeNull();
    expect(row?.entityLabel).toBe(owner.email);
  });
});

describe('superadmin activity, system and search', () => {
  it('shows every venue’s log with the venue name, platform rows included, and filters by venue', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    await api.patch(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(owner.accessToken)).send({ city: 'Beograd' });
    await api.post(`/api/superadmin/users/${owner.user.id}/reset-password`).set(bearer(admin.accessToken));

    const all = await api.get('/api/superadmin/activity').set(bearer(admin.accessToken));
    expect(all.status).toBe(200);
    const page = all.body as SuperadminActivityPageDto;
    const update = page.items.find((e) => e.action === 'restaurant.update')!;
    expect(update.restaurant).toEqual({ id: owner.restaurantId, name: 'Kafeterija' });
    const platform = page.items.find((e) => e.action === 'admin.user_reset_password')!;
    expect(platform.restaurant).toBeNull();
    expect(page.restaurants.some((r) => r.id === owner.restaurantId)).toBe(true);

    const filtered = await api.get(`/api/superadmin/activity?restaurantId=${owner.restaurantId}&kind=settings`).set(bearer(admin.accessToken));
    const items = (filtered.body as SuperadminActivityPageDto).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.restaurant?.id === owner.restaurantId)).toBe(true);
    expect(items.every((e) => e.action === 'restaurant.update')).toBe(true);

    const adminOnly = await api.get('/api/superadmin/activity?kind=admin').set(bearer(admin.accessToken));
    expect((adminOnly.body as SuperadminActivityPageDto).items.every((e) => e.action.startsWith('admin.') || e.action === 'auth.impersonate')).toBe(true);
  });

  it('reports the system status and finds venues, users, items and tables', async () => {
    const admin = await superadmin();
    const owner = await registerUser({ restaurantName: 'Kafeterija', name: 'Ana Petrović' });
    const cat = await api.post(`/api/admin/restaurants/${owner.restaurantId}/categories`).set(bearer(owner.accessToken)).send({ name: { sr: 'Kafa' } });
    await api.post(`/api/admin/restaurants/${owner.restaurantId}/items`).set(bearer(owner.accessToken)).send({ categoryId: cat.body.id, name: { sr: 'Espresso' }, priceCents: 18000 });
    await api.post(`/api/admin/restaurants/${owner.restaurantId}/tables`).set(bearer(owner.accessToken)).send({ number: 7, label: 'Terasa 7' });

    const system = await api.get('/api/superadmin/system').set(bearer(admin.accessToken));
    expect(system.status).toBe(200);
    const status = system.body as SystemStatusDto;
    expect(status).toMatchObject({ db: 'ok', version: 'dev', nodeEnv: 'test', mail: { provider: 'log' }, storage: { driver: 'local' }, mocks: { payments: true, pos: true } });
    expect(status.counts).toMatchObject({ restaurants: 2, users: 2, tables: 1, items: 1 });
    expect(status.queues.pos).toEqual({ queued: 0, running: 0, failed: 0, doneLast24h: 0 });
    expect(status.failedJobs).toEqual([]);

    const found = await api.get('/api/superadmin/search?q=espr').set(bearer(admin.accessToken));
    expect(found.body.items[0]).toMatchObject({ name: 'Espresso', restaurant: { id: owner.restaurantId } });
    const table = await api.get('/api/superadmin/search?q=7').set(bearer(admin.accessToken));
    expect(table.body.tables[0]).toMatchObject({ number: 7, label: 'Terasa 7' });
    const person = await api.get('/api/superadmin/search?q=petrov').set(bearer(admin.accessToken));
    expect(person.body.users[0]).toMatchObject({ email: owner.email });
    const venue = await api.get('/api/superadmin/search?q=kafet').set(bearer(admin.accessToken));
    expect(venue.body.restaurants[0]).toMatchObject({ slug: 'kafeterija' });

    const staffDenied = await api.get('/api/superadmin/system').set(bearer(owner.accessToken));
    expect(staffDenied.status).toBe(403);
  });
});
