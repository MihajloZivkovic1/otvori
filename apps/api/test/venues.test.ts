import { describe, expect, it } from 'vitest';
import type { MembershipDto, SuperadminRestaurantDto } from '@qr-menu/shared';
import { Restaurant, User } from '../src/db/models/index.js';
import { api, bearer, registerUser } from './helpers.js';

describe('health', () => {
  it('pings the database and reports the build version', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'ok', version: 'dev', features: { payments: true, pos: true } });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('adding venues', () => {
  it('is reserved for owners of a Pro venue', async () => {
    const owner = await registerUser({ restaurantName: 'Prva' });
    const denied = await api.post('/api/admin/restaurants').set(bearer(owner.accessToken)).send({ name: 'Druga' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('PLAN_REQUIRED');

    await Restaurant.update({ plan: 'pro', status: 'active' }, { where: { id: owner.restaurantId } });
    const created = await api.post('/api/admin/restaurants').set(bearer(owner.accessToken)).send({ name: 'Druga' });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('druga');
    expect(created.body.plan).toBe('trial');
    expect(created.body.status).toBe('trial');
    expect(created.body.id).not.toBe(owner.restaurantId);

    const me = await api.get('/api/auth/me').set(bearer(owner.accessToken));
    const memberships = me.body.memberships as MembershipDto[];
    expect(memberships).toHaveLength(2);
    const second = memberships.find((m) => m.restaurant.id === created.body.id)!;
    expect(second.role).toBe('owner');
    expect(second.restaurant).toMatchObject({ city: null, primaryColor: '#7A3E48', plan: 'trial' });

    // The new venue is an ordinary tenant: its owner can read it, a stranger cannot.
    const own = await api.get(`/api/admin/restaurants/${created.body.id}`).set(bearer(owner.accessToken));
    expect(own.status).toBe(200);
    const stranger = await registerUser();
    const forbidden = await api.get(`/api/admin/restaurants/${created.body.id}`).set(bearer(stranger.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('makes the slug unique, validates the name and requires a session', async () => {
    const owner = await registerUser({ restaurantName: 'Caffe Nova' });
    await Restaurant.update({ plan: 'pro' }, { where: { id: owner.restaurantId } });
    const dup = await api.post('/api/admin/restaurants').set(bearer(owner.accessToken)).send({ name: 'Caffe Nova' });
    expect(dup.status).toBe(201);
    expect(dup.body.slug).toBe('caffe-nova-2');

    const invalid = await api.post('/api/admin/restaurants').set(bearer(owner.accessToken)).send({ name: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const anonymous = await api.post('/api/admin/restaurants').send({ name: 'Nobody' });
    expect(anonymous.status).toBe(401);
  });

  it('is open to superadmins, whose index lists city, color and logo', async () => {
    const admin = await registerUser({ restaurantName: 'HQ' });
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });
    await Restaurant.update({ city: 'Novi Sad', primaryColor: '#123456' }, { where: { id: admin.restaurantId } });

    const created = await api.post('/api/admin/restaurants').set(bearer(admin.accessToken)).send({ name: 'Second' });
    expect(created.status).toBe(201);

    const list = await api.get('/api/superadmin/restaurants').set(bearer(admin.accessToken));
    expect(list.status).toBe(200);
    const rows = list.body.items as SuperadminRestaurantDto[];
    expect(rows.find((r) => r.id === admin.restaurantId)).toMatchObject({ city: 'Novi Sad', primaryColor: '#123456', logoUrl: null });
    expect(rows.find((r) => r.id === created.body.id)).toMatchObject({ city: null, primaryColor: '#7A3E48' });

    const me = await api.get('/api/auth/me').set(bearer(admin.accessToken));
    const memberships = me.body.memberships as MembershipDto[];
    expect(memberships.find((m) => m.restaurant.id === admin.restaurantId)!.restaurant.city).toBe('Novi Sad');
  });
});

describe('table QR codes', () => {
  it('encode the menu URL as /t/<number>', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const table = await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/tables`)
      .set(bearer(owner.accessToken))
      .send({ number: 7 });
    expect(table.status).toBe(201);
    expect(table.body.menuUrl).toBe('http://kafeterija.localhost:5174/t/7');

    const list = await api.get(`/api/admin/restaurants/${owner.restaurantId}/tables`).set(bearer(owner.accessToken));
    expect(list.body[0].menuUrl).toBe('http://kafeterija.localhost:5174/t/7');
  });
});
