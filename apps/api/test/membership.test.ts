import { describe, expect, it } from 'vitest';
import { Membership, User } from '../src/db/models/index.js';
import { api, bearer, createCategory, createItem, registerUser } from './helpers.js';

describe('membership isolation', () => {
  it('user A cannot read or modify restaurant B', async () => {
    const a = await registerUser();
    const b = await registerUser();

    const read = await api.get(`/api/admin/restaurants/${b.restaurantId}`).set(bearer(a.accessToken));
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');

    const patch = await api
      .patch(`/api/admin/restaurants/${b.restaurantId}`)
      .set(bearer(a.accessToken))
      .send({ name: 'Hacked' });
    expect(patch.status).toBe(403);

    const list = await api.get(`/api/admin/restaurants/${b.restaurantId}/categories`).set(bearer(a.accessToken));
    expect(list.status).toBe(403);

    const own = await api.get(`/api/admin/restaurants/${a.restaurantId}`).set(bearer(a.accessToken));
    expect(own.status).toBe(200);
    expect(own.body.id).toBe(a.restaurantId);
  });

  it("scopes child resources: B's category and item ids are invisible under A's restaurant", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const categoryB = await createCategory(b, { name: { sr: 'Kafa' } });
    const itemB = await createItem(b, { categoryId: categoryB.id, name: { sr: 'Espresso' }, priceCents: 18000 });

    const patchCategory = await api
      .patch(`/api/admin/restaurants/${a.restaurantId}/categories/${categoryB.id}`)
      .set(bearer(a.accessToken))
      .send({ isHidden: true });
    expect(patchCategory.status).toBe(404);

    const getItem = await api
      .get(`/api/admin/restaurants/${a.restaurantId}/items/${itemB.id}`)
      .set(bearer(a.accessToken));
    expect(getItem.status).toBe(404);

    // Creating an item under A's restaurant but pointing at B's category is rejected.
    const crossCreate = await api
      .post(`/api/admin/restaurants/${a.restaurantId}/items`)
      .set(bearer(a.accessToken))
      .send({ categoryId: categoryB.id, name: { sr: 'Uljez' }, priceCents: 100 });
    expect(crossCreate.status).toBe(404);

    // Reordering with foreign ids fails and changes nothing.
    const reorder = await api
      .put(`/api/admin/restaurants/${a.restaurantId}/categories/reorder`)
      .set(bearer(a.accessToken))
      .send([categoryB.id]);
    expect(reorder.status).toBe(400);

    const listA = await api.get(`/api/admin/restaurants/${a.restaurantId}/items`).set(bearer(a.accessToken));
    expect(listA.status).toBe(200);
    expect(listA.body).toEqual([]);
    const listB = await api.get(`/api/admin/restaurants/${b.restaurantId}/items`).set(bearer(b.accessToken));
    expect(listB.body.map((i: { id: string }) => i.id)).toEqual([itemB.id]);
  });

  it('staff can read the venue but not change menu content, settings or delete (Phase 11 matrix)', async () => {
    const owner = await registerUser();
    const staff = await registerUser();
    await Membership.create({ userId: staff.user.id, restaurantId: owner.restaurantId, role: 'staff' });

    const read = await api.get(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(staff.accessToken));
    expect(read.status).toBe(200);

    const staffCreate = await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/categories`)
      .set(bearer(staff.accessToken))
      .send({ name: { sr: 'Doručak', en: 'Breakfast' } });
    expect(staffCreate.status).toBe(403);
    expect(staffCreate.body.error.code).toBe('ROLE_REQUIRED');
    const category = await createCategory(owner, { name: { sr: 'Doručak', en: 'Breakfast' } });
    expect(category.restaurantId).toBe(owner.restaurantId);

    const settings = await api
      .patch(`/api/admin/restaurants/${owner.restaurantId}`)
      .set(bearer(staff.accessToken))
      .send({ name: 'New name' });
    expect(settings.status).toBe(403);

    const publish = await api.post(`/api/admin/restaurants/${owner.restaurantId}/publish`).set(bearer(staff.accessToken));
    expect(publish.status).toBe(403);

    const destroy = await api
      .delete(`/api/admin/restaurants/${owner.restaurantId}/categories/${category.id}`)
      .set(bearer(staff.accessToken));
    expect(destroy.status).toBe(403);

    const ownerDestroy = await api
      .delete(`/api/admin/restaurants/${owner.restaurantId}/categories/${category.id}`)
      .set(bearer(owner.accessToken));
    expect(ownerDestroy.status).toBe(204);
  });

  it('superadmin can act on any restaurant and use /api/superadmin', async () => {
    const owner = await registerUser({ restaurantName: 'Bistro Zemun' });
    const admin = await registerUser();
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });

    const forbidden = await api.get('/api/superadmin/restaurants').set(bearer(owner.accessToken));
    expect(forbidden.status).toBe(403);

    const list = await api.get('/api/superadmin/restaurants?search=zemun').set(bearer(admin.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].slug).toBe('bistro-zemun');
    expect(list.body.items[0].owner.email).toBe(owner.email);

    const update = await api
      .patch(`/api/superadmin/restaurants/${owner.restaurantId}`)
      .set(bearer(admin.accessToken))
      .send({ status: 'active', plan: 'pro', trialEndsAt: null });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe('active');
    expect(update.body.plan).toBe('pro');

    const asOwner = await api.get(`/api/admin/restaurants/${owner.restaurantId}`).set(bearer(admin.accessToken));
    expect(asOwner.status).toBe(200);

    const missing = await api
      .get('/api/admin/restaurants/00000000-0000-4000-8000-000000000000')
      .set(bearer(admin.accessToken));
    expect(missing.status).toBe(404);
  });
});
