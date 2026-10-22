import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { TableDto } from '@qr-menu/shared';
import { User } from '../src/db/models/index.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

const session = () => ({ 'X-Session-Id': randomUUID() });

async function venue() {
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const category = await createCategory(owner, { name: { sr: 'Kafa' } });
  const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 18000 });
  const table = (await api.post(`${admin}/tables`).set(bearer(owner.accessToken)).send({ number: 7, label: 'Sto 7' })).body as TableDto;
  await publish(owner);
  return { owner, slug, admin, item, table, auth: bearer(owner.accessToken) };
}

describe('restaurant modules', () => {
  it('starts with every module off and exposes them to the owner and the public menu', async () => {
    const v = await venue();
    const res = await api.get(v.admin).set(v.auth);
    expect(res.body.modules).toEqual({ ordering: false, payments: false, pos: false });
    const menu = await api.get(`/api/public/${v.slug}/menu`);
    expect(menu.body.restaurant.modules).toEqual({ ordering: false, payments: false, pos: false });
    expect(menu.body.restaurant.orderingMode).toBe('off');
  });

  it('gates every ordering endpoint with 403 MODULE_DISABLED while the module is off, whatever orderingMode says', async () => {
    const v = await venue();
    // The setting itself is accepted (it is remembered for when the module comes on) but has no effect.
    await api.patch(v.admin).set(v.auth).send({ orderingMode: 'order' });
    const menu = await api.get(`/api/public/${v.slug}/menu`);
    expect(menu.body.restaurant.orderingMode).toBe('off');

    for (const [method, path, body] of [
      ['get', `${v.admin}/orders`, undefined],
      ['get', `${v.admin}/requests`, undefined],
      ['post', `${v.admin}/sse-token`, {}],
      ['post', `${v.admin}/tables/${v.table.id}/block`, {}],
      ['delete', `${v.admin}/tables/${v.table.id}/block`, undefined],
    ] as const) {
      const res = await api[method](path).set(v.auth).send(body);
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
      expect(res.body.error.details).toEqual({ module: 'ordering' });
    }

    const order = await api
      .post(`/api/public/${v.slug}/orders`)
      .set(session())
      .send({ tableNumber: 7, items: [{ itemId: v.item.id, quantity: 1 }] });
    expect(order.status).toBe(403);
    expect(order.body.error.code).toBe('MODULE_DISABLED');
    const call = await api.post(`/api/public/${v.slug}/requests`).set(session()).send({ type: 'call_waiter', tableNumber: 7 });
    expect(call.status).toBe(403);
    expect(call.body.error.code).toBe('MODULE_DISABLED');

    const analytics = await api.get(`${v.admin}/analytics?range=7d`).set(v.auth);
    expect(analytics.status).toBe(200);
    expect(analytics.body.ordering).toBeNull();
  });

  it('lets the owner switch ordering on (and only ordering), after which the saved mode applies', async () => {
    const v = await venue();
    const denied = await api.patch(v.admin).set(v.auth).send({ modules: { payments: true } });
    expect(denied.status).toBe(400);

    const on = await api.patch(v.admin).set(v.auth).send({ modules: { ordering: true }, orderingMode: 'order' });
    expect(on.status).toBe(200);
    expect(on.body.modules).toEqual({ ordering: true, payments: false, pos: false });

    const menu = await api.get(`/api/public/${v.slug}/menu`);
    expect(menu.body.restaurant.orderingMode).toBe('order');
    const orders = await api.get(`${v.admin}/orders`).set(v.auth);
    expect(orders.status).toBe(200);
    const analytics = await api.get(`${v.admin}/analytics?range=7d`).set(v.auth);
    expect(analytics.body.ordering).not.toBeNull();

    const order = await api
      .post(`/api/public/${v.slug}/orders`)
      .set(session())
      .send({ tableNumber: 7, items: [{ itemId: v.item.id, quantity: 1 }] });
    expect(order.status).toBe(201);

    // Switching the module off again does not touch the mode setting but makes the venue view-only at once.
    await api.patch(v.admin).set(v.auth).send({ modules: { ordering: false } });
    const after = await api.get(v.admin).set(v.auth);
    expect(after.body.orderingMode).toBe('order');
    expect((await api.get(`/api/public/${v.slug}/menu`)).body.restaurant.orderingMode).toBe('off');
    expect((await api.get(`${v.admin}/orders`).set(v.auth)).status).toBe(403);
  });

  it('is hidden from staff edits and open to superadmins for payments and POS', async () => {
    const v = await venue();
    const admin = await registerUser({ restaurantName: 'HQ' });
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });

    const res = await api
      .patch(`/api/superadmin/restaurants/${v.owner.restaurantId}`)
      .set(bearer(admin.accessToken))
      .send({ modules: { payments: true, pos: true } });
    expect(res.status).toBe(200);
    expect(res.body.modules).toEqual({ ordering: false, payments: true, pos: true });

    const list = await api.get('/api/superadmin/restaurants?search=Kafeterija').set(bearer(admin.accessToken));
    expect(list.body.items[0].modules).toEqual({ ordering: false, payments: true, pos: true });
    const owner = await api.get(v.admin).set(v.auth);
    expect(owner.body.modules).toEqual({ ordering: false, payments: true, pos: true });
  });
});
