import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_FEATURE_FLAGS, type PublicOrderDto } from '@qr-menu/shared';
import { createApp } from '../src/app.js';
import { features, setFeaturesForTests } from '../src/config/features.js';
import { Restaurant, User } from '../src/db/models/index.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

const session = () => ({ 'X-Session-Id': randomUUID() });

/** Owner venue in `order` mode with payments + pos stored as ON directly in the database (bypassing every guard). */
async function venueWithEverythingStored() {
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const auth = bearer(owner.accessToken);
  const category = await createCategory(owner, { name: { sr: 'Kafa' } });
  const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 22000 });
  await api.post(`${admin}/tables`).set(auth).send({ number: 7, label: 'Sto 7' });
  await publish(owner);
  await api.patch(admin).set(auth).send({ modules: { ordering: true }, orderingMode: 'order' });
  await Restaurant.update({ modules: { ordering: true, payments: true, pos: true } }, { where: { id: owner.restaurantId } });
  const root = await registerUser({ restaurantName: 'HQ' });
  await User.update({ isSuperadmin: true }, { where: { id: root.user.id } });
  return { owner, slug, admin, auth, item, root: bearer(root.accessToken) };
}

describe('global feature flags', () => {
  it('default to payments off and POS on', () => {
    expect(DEFAULT_FEATURE_FLAGS).toEqual({ payments: false, pos: true });
  });

  it('are reported by GET /api/health and GET /api/config', async () => {
    const health = await api.get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.features).toEqual({ payments: true, pos: true }); // vitest.config.ts switches payments on for the suite
    const config = await api.get('/api/config');
    expect(config.status).toBe(200);
    expect(config.headers['cache-control']).toBe('public, max-age=60');
    expect(config.body).toEqual({ version: 'dev', features: { payments: true, pos: true } });
  });

  describe('with FEATURE_PAYMENTS=false', () => {
    let restore: () => void;
    let off: ReturnType<typeof supertest>;
    beforeAll(() => {
      restore = setFeaturesForTests({ payments: false });
      off = supertest(createApp());
    });
    afterAll(() => restore());

    it('reads as off in health and config', async () => {
      expect(features.payments).toBe(false);
      expect((await off.get('/api/health')).body.features).toEqual({ payments: false, pos: true });
      expect((await off.get('/api/config')).body.features).toEqual({ payments: false, pos: true });
    });

    it('masks the module in every DTO even when the venue has it stored', async () => {
      const v = await venueWithEverythingStored();
      const stored = await Restaurant.findByPk(v.owner.restaurantId);
      expect(stored!.modules.payments).toBe(true);

      const admin = await off.get(v.admin).set(v.auth);
      expect(admin.status).toBe(200);
      expect(admin.body.modules).toEqual({ ordering: true, payments: false, pos: true });

      const menu = await off.get(`/api/public/${v.slug}/menu`);
      expect(menu.body.restaurant.modules).toEqual({ ordering: true, payments: false, pos: true });

      const list = await off.get('/api/superadmin/restaurants').set(v.root);
      const row = (list.body.items as { id: string; modules: Record<string, boolean> }[]).find((r) => r.id === v.owner.restaurantId);
      expect(row?.modules).toEqual({ ordering: true, payments: false, pos: true });

      // The guest never sees a pay button: PublicOrderDto.payments.enabled is false regardless of the stored config.
      const order = await off
        .post(`/api/public/${v.slug}/orders`)
        .set(session())
        .send({ tableNumber: 7, items: [{ itemId: v.item.id, quantity: 1 }] });
      expect(order.status).toBe(201);
      expect((order.body as PublicOrderDto).payments.enabled).toBe(false);
    });

    it('answers 404 on every payment route, the webhook and the simulator', async () => {
      const v = await venueWithEverythingStored();
      const order = await off
        .post(`/api/public/${v.slug}/orders`)
        .set(session())
        .send({ tableNumber: 7, items: [{ itemId: v.item.id, quantity: 1 }] });
      const orderId = (order.body as PublicOrderDto).id;

      for (const [method, path, headers, body] of [
        ['get', `${v.admin}/payment-config`, v.auth, undefined],
        ['patch', `${v.admin}/payment-config`, v.auth, { provider: 'mock', merchantId: 'X', secret: 's' }],
        ['post', `${v.admin}/payment-config/test`, v.auth, {}],
        ['patch', `${v.admin}/orders/${orderId}/payment`, v.auth, { paymentStatus: 'cash' }],
        ['post', `/api/public/${v.slug}/orders/${orderId}/payments`, session(), { tipPercent: 0 }],
        ['get', `/api/public/${v.slug}/orders/${orderId}/payments/some-ref`, session(), undefined],
        ['post', '/api/webhooks/payments/mock', {}, { providerRef: 'x', status: 'paid' }],
        ['get', '/dev/pay/some-ref', {}, undefined],
      ] as const) {
        const res = await off[method](path).set(headers).send(body);
        expect(res.status, `${method.toUpperCase()} ${path}`).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    });

    it('does not let a superadmin switch the module on, and leaves the stored value alone', async () => {
      const v = await venueWithEverythingStored();
      // The drawer sends the modules back masked (payments:false); the stored true must survive that round-trip.
      const masked = await off.patch(`/api/superadmin/restaurants/${v.owner.restaurantId}`).set(v.root).send({ modules: { ordering: true, payments: false, pos: false } });
      expect(masked.status).toBe(200);
      expect(masked.body.modules).toEqual({ ordering: true, payments: false, pos: false });
      expect((await Restaurant.findByPk(v.owner.restaurantId))!.modules).toEqual({ ordering: true, payments: true, pos: false });

      // And switching it on for a venue without it has no effect either.
      const other = await registerUser({ restaurantName: 'Bistro' });
      const on = await off.patch(`/api/superadmin/restaurants/${other.restaurantId}`).set(v.root).send({ modules: { payments: true } });
      expect(on.status).toBe(200);
      expect((await Restaurant.findByPk(other.restaurantId))!.modules.payments).toBe(false);
    });

    it('keeps POS working while only payments is off', async () => {
      const v = await venueWithEverythingStored();
      const pos = await off.get(`${v.admin}/pos-config`).set(v.auth);
      expect(pos.status).toBe(200);
    });
  });

  describe('with FEATURE_POS=false', () => {
    it('hides POS the same way', async () => {
      const restore = setFeaturesForTests({ pos: false });
      try {
        const v = await venueWithEverythingStored();
        expect((await api.get(v.admin).set(v.auth)).body.modules.pos).toBe(false);
        expect((await api.get(`${v.admin}/pos-config`).set(v.auth)).status).toBe(404);
        expect((await api.get(`${v.admin}/pos/products`).set(v.auth)).status).toBe(404);
      } finally {
        restore();
      }
    });
  });
});
