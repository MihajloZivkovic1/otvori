import { describe, expect, it } from 'vitest';
import { ItemView, ScanEvent, User } from '../src/db/models/index.js';
import { api, bearer, createCategory, createItem, publish, registerUser, type RegisteredUser } from './helpers.js';

async function seedMenu(owner: RegisteredUser) {
  const coffee = await createCategory(owner, { name: { sr: 'Kafa', en: 'Coffee' } });
  const hidden = await createCategory(owner, { name: { sr: 'Sezonsko', en: 'Seasonal' }, isHidden: true });
  const empty = await createCategory(owner, { name: { sr: 'Prazna', en: 'Empty' } });
  const espresso = await createItem(owner, {
    categoryId: coffee.id,
    name: { sr: 'Espreso', en: 'Espresso' },
    description: { sr: 'Jaka kafa', en: 'Strong coffee' },
    priceCents: 18000,
    allergens: [],
    tags: ['new'],
    variantLabel: { sr: 'Vrsta kafe', en: 'Coffee blend' },
    variants: [
      { name: 'Dupli', priceCents: 22000, sortOrder: 1 },
      { name: 'Jedan', priceCents: 18000, sortOrder: 0 },
    ],
  });
  const srOnly = await createItem(owner, { categoryId: coffee.id, name: { sr: 'Domaća kafa' }, priceCents: 15000 });
  const unavailable = await createItem(owner, {
    categoryId: coffee.id,
    name: { sr: 'Nema', en: 'Gone' },
    priceCents: 100,
    isAvailable: false,
  });
  const seasonal = await createItem(owner, { categoryId: hidden.id, name: { sr: 'Bundeva', en: 'Pumpkin' }, priceCents: 300 });
  return { coffee, hidden, empty, espresso, srOnly, unavailable, seasonal };
}

describe('public menu', () => {
  it('is 404 until published and 404 for unknown slugs', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;

    const unpublished = await api.get(`/api/public/${slug}/menu`);
    expect(unpublished.status).toBe(404);
    expect(unpublished.body.error.code).toBe('MENU_NOT_PUBLISHED');

    const unknown = await api.get('/api/public/does-not-exist/menu');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('RESTAURANT_NOT_FOUND');
  });

  it('hides hidden and empty categories and resolves the default locale', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;
    const menu = await seedMenu(owner);
    await publish(owner);

    const res = await api.get(`/api/public/${slug}/menu`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    expect(res.body.locale).toBe('sr');
    expect(res.body.restaurant.slug).toBe(slug);
    expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual([menu.coffee.id]);

    const [coffee] = res.body.categories;
    expect(coffee.name).toBe('Kafa');
    const names = coffee.items.map((i: { name: string }) => i.name);
    expect(names).toEqual(['Espreso', 'Domaća kafa', 'Nema']);
    expect(names).not.toContain('Bundeva');

    const espresso = coffee.items[0];
    expect(espresso.description).toBe('Jaka kafa');
    expect(espresso.priceCents).toBe(18000);
    expect(espresso.tags).toEqual(['new']);
    expect(espresso.isAvailable).toBe(true);
    expect(espresso.variants.map((v: { name: string }) => v.name)).toEqual(['Jedan', 'Dupli']);
    expect(espresso.variantLabel).toBe('Vrsta kafe');
    expect(coffee.items[1].variantLabel).toBeNull();
    expect(coffee.items[2].isAvailable).toBe(false);
  });

  it('resolves the requested locale and falls back to the default locale per field', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;
    await seedMenu(owner);
    await publish(owner);

    const en = await api.get(`/api/public/${slug}/menu?locale=en`);
    expect(en.status).toBe(200);
    expect(en.body.locale).toBe('en');
    expect(en.body.categories[0].name).toBe('Coffee');
    const names = en.body.categories[0].items.map((i: { name: string }) => i.name);
    expect(names).toEqual(['Espresso', 'Domaća kafa', 'Gone']);
    expect(en.body.categories[0].items[0].description).toBe('Strong coffee');
    expect(en.body.categories[0].items[0].variantLabel).toBe('Coffee blend');

    const unsupported = await api.get(`/api/public/${slug}/menu?locale=de`);
    expect(unsupported.status).toBe(400);

    // Restaurant that only supports SR: EN request falls back to SR entirely.
    await api
      .patch(`/api/admin/restaurants/${owner.restaurantId}`)
      .set(bearer(owner.accessToken))
      .send({ supportedLocales: ['sr'] });
    const fallback = await api.get(`/api/public/${slug}/menu?locale=en`);
    expect(fallback.status).toBe(200);
    expect(fallback.body.locale).toBe('sr');
    expect(fallback.body.categories[0].name).toBe('Kafa');
  });

  it('resolves the restaurant from the Host header subdomain', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;
    await seedMenu(owner);
    await publish(owner);

    const res = await api.get('/api/public/menu').set('Host', `${slug}.localhost:5174`);
    expect(res.status).toBe(200);
    expect(res.body.restaurant.slug).toBe(slug);

    const noHost = await api.get('/api/public/menu').set('Host', 'localhost:3000');
    expect(noHost.status).toBe(404);
  });

  it('is hidden when the restaurant is suspended', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;
    await seedMenu(owner);
    await publish(owner);

    const admin = await registerUser();
    await User.update({ isSuperadmin: true }, { where: { id: admin.user.id } });
    await api
      .patch(`/api/superadmin/restaurants/${owner.restaurantId}`)
      .set(bearer(admin.accessToken))
      .send({ status: 'suspended' });

    const res = await api.get(`/api/public/${slug}/menu`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MENU_NOT_PUBLISHED');
  });

  it('records scan and item_view events that feed analytics', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const slug = owner.memberships[0]!.restaurant.slug;
    const menu = await seedMenu(owner);
    await publish(owner);
    await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/tables`)
      .set(bearer(owner.accessToken))
      .send({ number: 5, label: 'Sto 5' });

    const sessionId = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
    const scan = await api.post(`/api/public/${slug}/events`).send({ type: 'scan', sessionId, tableNumber: 5 });
    expect(scan.status).toBe(202);
    // A refresh within the dedup window does not count twice.
    await api.post(`/api/public/${slug}/events`).send({ type: 'scan', sessionId, tableNumber: 5 });
    const view = await api.post(`/api/public/${slug}/events`).send({ type: 'item_view', sessionId, itemId: menu.espresso.id });
    expect(view.status).toBe(202);

    expect(await ScanEvent.count()).toBe(1);
    expect(await ItemView.count()).toBe(1);

    const bad = await api.post(`/api/public/${slug}/events`).send({ type: 'item_view', sessionId });
    expect(bad.status).toBe(400);

    const analytics = await api
      .get(`/api/admin/restaurants/${owner.restaurantId}/analytics?range=7d`)
      .set(bearer(owner.accessToken));
    expect(analytics.status).toBe(200);
    expect(analytics.body.totalScans.value).toBe(1);
    expect(analytics.body.itemsViewedPerScan.value).toBe(1);
    expect(analytics.body.scansPerDay).toHaveLength(7);
    expect(analytics.body.topItems[0].itemId).toBe(menu.espresso.id);
    expect(analytics.body.scansByTable.find((t: { number: number }) => t.number === 5).scans).toBe(1);

    const tables = await api.get(`/api/admin/restaurants/${owner.restaurantId}/tables`).set(bearer(owner.accessToken));
    expect(tables.body[0].scansLast7Days).toBe(1);
    expect(tables.body[0].lastScanAt).toBeTypeOf('string');
  });
});

describe('branding — background color', () => {
  it('defaults to the cream, accepts a light color and rejects a dark one', async () => {
    const owner = await registerUser();
    await seedMenu(owner);
    const published = await publish(owner);
    expect(published.backgroundColor).toBe('#F7F2EB');

    const white = await api
      .patch(`/api/admin/restaurants/${owner.restaurantId}`)
      .set(bearer(owner.accessToken))
      .send({ backgroundColor: '#FFFFFF' });
    expect(white.status).toBe(200);
    expect(white.body.backgroundColor).toBe('#FFFFFF');

    const menu = await api.get(`/api/public/${published.slug}/menu`);
    expect(menu.status).toBe(200);
    expect(menu.body.restaurant).toMatchObject({ backgroundColor: '#FFFFFF', primaryColor: '#7A3E48', theme: 'light' });

    const dark = await api
      .patch(`/api/admin/restaurants/${owner.restaurantId}`)
      .set(bearer(owner.accessToken))
      .send({ backgroundColor: '#1B1816' });
    expect(dark.status).toBe(400);
    expect(dark.body.error.code).toBe('VALIDATION_ERROR');
  });
});
