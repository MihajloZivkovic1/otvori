import { describe, expect, it } from 'vitest';
import { User } from '../src/db/models/index.js';
import { addStaff, api, bearer, createCategory, createItem, registerUser } from './helpers.js';

/**
 * The owner/service matrix from docs/PERMISSIONS.md: staff may do service work (orders, availability, blocking a
 * table, reading) and nothing that changes prices, content, structure, branding, settings or the team.
 */
describe('permission matrix (Phase 11)', () => {
  it('a staff token cannot change a price, create an item or touch menu structure', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espresso' }, priceCents: 18000 });

    const price = await api.patch(`${base}/items/${item.id}`).set(bearer(staff.accessToken)).send({ priceCents: 25000 });
    expect(price.status).toBe(403);
    expect(price.body.error.code).toBe('ROLE_REQUIRED');
    const unchanged = await api.get(`${base}/items/${item.id}`).set(bearer(staff.accessToken));
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.priceCents).toBe(18000);

    const create = await api.post(`${base}/items`).set(bearer(staff.accessToken)).send({ categoryId: category.id, name: { sr: 'Uljez' }, priceCents: 100 });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('ROLE_REQUIRED');

    const denied: Array<[string, string, unknown?]> = [
      ['delete', `${base}/items/${item.id}`],
      ['put', `${base}/items/reorder`, [item.id]],
      ['post', `${base}/items/${item.id}/image`],
      ['post', `${base}/categories`, { name: { sr: 'Nova' } }],
      ['patch', `${base}/categories/${category.id}`, { isHidden: true }],
      ['put', `${base}/categories/reorder`, [category.id]],
      ['delete', `${base}/categories/${category.id}`],
      ['post', `${base}/tables`, { number: 1 }],
      ['get', `${base}/tables/qr-sheet.pdf`],
      ['get', `${base}/qr.png`],
      ['get', `${base}/qr-card.pdf`],
      ['patch', base, { name: 'X' }],
      ['post', `${base}/logo`],
      ['post', `${base}/publish`],
      ['delete', base],
      ['get', `${base}/team`],
      ['post', `${base}/team/invites`, { email: 'x@y.z' }],
      ['get', `${base}/audit-log`],
      ['put', `${base}/security/pin`, { pin: '2580', password: staff.password }],
      ['post', `${base}/security/unlock`, { pin: '2580' }],
    ];
    for (const [method, url, body] of denied) {
      const res = await (api as unknown as Record<string, (u: string) => import('supertest').Test>)[method]!(url)
        .set(bearer(staff.accessToken))
        .send(body as object | undefined);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
      expect(res.body.error.code, `${method.toUpperCase()} ${url}`).toBe('ROLE_REQUIRED');
    }
  });

  it('staff keep every service action: reading, availability, "back at 06:00", table blocks, orders and calls', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espresso' }, priceCents: 18000 });
    const table = await api.post(`${base}/tables`).set(bearer(owner.accessToken)).send({ number: 7 });
    expect(table.status).toBe(201);
    await api.patch(base).set(bearer(owner.accessToken)).send({ modules: { ordering: true }, orderingMode: 'order' });

    for (const url of [base, `${base}/categories`, `${base}/items`, `${base}/tables`, `${base}/analytics?range=7d`, `${base}/orders`, `${base}/requests`, `${base}/security`]) {
      const res = await api.get(url).set(bearer(staff.accessToken));
      expect(res.status, url).toBe(200);
    }
    const off = await api.patch(`${base}/items/${item.id}/availability`).set(bearer(staff.accessToken)).send({ available: false, until: 'tomorrow-06:00' });
    expect(off.status).toBe(200);
    expect(off.body.isEffectivelyAvailable).toBe(false);
    expect(off.body.unavailableUntil).not.toBeNull();
    const on = await api.patch(`${base}/items/${item.id}/availability`).set(bearer(staff.accessToken)).send({ available: true });
    expect(on.status).toBe(200);
    expect(on.body.isEffectivelyAvailable).toBe(true);

    const block = await api.post(`${base}/tables/${table.body.id}/block`).set(bearer(staff.accessToken));
    expect(block.status).toBe(200);
    expect(block.body.blockedUntil).not.toBeNull();
    const sse = await api.post(`${base}/sse-token`).set(bearer(staff.accessToken));
    expect(sse.status).toBe(200);
  });

  it('superadmins pass every owner route as implicit owners, even with a PIN set', async () => {
    const owner = await registerUser();
    const admin = await registerUser();
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    await api.put(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ pin: '2580', password: owner.password });

    const res = await api.post(`${base}/categories`).set(bearer(admin.accessToken)).send({ name: { sr: 'Support' } });
    expect(res.status).toBe(201);
  });
});
