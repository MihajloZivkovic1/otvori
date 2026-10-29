import { describe, expect, it } from 'vitest';
import type { CreatePromotionInput, PromotionDto, PublicPromotionDto } from '@qr-menu/shared';
import { AuditLog, Promotion } from '../src/db/models/index.js';
import { isPromotionActiveNow, isoWeekday } from '../src/modules/promotions/active.js';
import { addStaff, api, bearer, createCategory, createItem, publish, registerUser, type RegisteredUser } from './helpers.js';

const BELGRADE = 'Europe/Belgrade';
/** Friday 2026-10-30 (CET, UTC+1 after the DST switch on 2026-10-25). */
const belgrade = (day: number, hhmm: string) => new Date(`2026-10-${String(day).padStart(2, '0')}T${hhmm}:00+01:00`);

describe('isPromotionActiveNow', () => {
  const always = { isActive: true, startsAt: null, endsAt: null, recurrence: null };

  it('knows ISO weekdays', () => {
    expect(isoWeekday(2026, 10, 30)).toBe(5); // Friday
    expect(isoWeekday(2026, 11, 1)).toBe(7); // Sunday
    expect(isoWeekday(2026, 11, 2)).toBe(1); // Monday
  });

  it('respects the active flag and the date range', () => {
    const now = belgrade(30, '12:00');
    expect(isPromotionActiveNow(always, BELGRADE, now)).toBe(true);
    expect(isPromotionActiveNow({ ...always, isActive: false }, BELGRADE, now)).toBe(false);
    expect(isPromotionActiveNow({ ...always, startsAt: belgrade(30, '12:01') }, BELGRADE, now)).toBe(false);
    expect(isPromotionActiveNow({ ...always, startsAt: belgrade(30, '11:59') }, BELGRADE, now)).toBe(true);
    expect(isPromotionActiveNow({ ...always, endsAt: belgrade(30, '11:59') }, BELGRADE, now)).toBe(false);
    expect(isPromotionActiveNow({ ...always, endsAt: belgrade(30, '12:00') }, BELGRADE, now)).toBe(true);
  });

  it('applies a same-day recurrence window in the venue time zone', () => {
    const happyHour = { ...always, recurrence: { weekdays: [1, 2, 3, 4, 5], from: '16:00', to: '18:00' } };
    expect(isPromotionActiveNow(happyHour, BELGRADE, belgrade(30, '15:59'))).toBe(false);
    expect(isPromotionActiveNow(happyHour, BELGRADE, belgrade(30, '16:00'))).toBe(true);
    expect(isPromotionActiveNow(happyHour, BELGRADE, belgrade(30, '17:59'))).toBe(true);
    expect(isPromotionActiveNow(happyHour, BELGRADE, belgrade(30, '18:00'))).toBe(false);
    // Saturday is not in the list.
    expect(isPromotionActiveNow(happyHour, BELGRADE, belgrade(31, '17:00'))).toBe(false);
    // The same instant read in UTC is 16:00 Belgrade = 15:00 UTC: outside the window for a UTC venue.
    expect(isPromotionActiveNow(happyHour, 'UTC', belgrade(30, '16:30'))).toBe(false);
    expect(isPromotionActiveNow(happyHour, 'UTC', belgrade(30, '17:30'))).toBe(true);
  });

  it('handles windows that cross midnight (Friday 22:00 → 02:00 covers Saturday 01:00)', () => {
    const lateNight = { ...always, recurrence: { weekdays: [5], from: '22:00', to: '02:00' } };
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(30, '21:59'))).toBe(false);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(30, '22:00'))).toBe(true);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(30, '23:59'))).toBe(true);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(31, '00:30'))).toBe(true);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(31, '01:59'))).toBe(true);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(31, '02:00'))).toBe(false);
    // Thursday night / Saturday night are not Friday's window.
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(29, '23:00'))).toBe(false);
    expect(isPromotionActiveNow(lateNight, BELGRADE, belgrade(31, '23:00'))).toBe(false);
    expect(isPromotionActiveNow(lateNight, BELGRADE, new Date('2026-11-01T00:30:00+01:00'))).toBe(false); // Sunday small hours
    // Sunday → Monday wrap: a Sunday window reaches Monday 01:00.
    const sunday = { ...always, recurrence: { weekdays: [7], from: '23:00', to: '01:30' } };
    expect(isPromotionActiveNow(sunday, BELGRADE, new Date('2026-11-02T01:00:00+01:00'))).toBe(true);
    expect(isPromotionActiveNow(sunday, BELGRADE, new Date('2026-11-02T01:30:00+01:00'))).toBe(false);
  });
});

const deal = (overrides: Partial<CreatePromotionInput> = {}): CreatePromotionInput =>
  ({ title: 'Deal', template: 'deal', content: { headline: '2 for 1', priceCents: 50000 }, ...overrides }) as CreatePromotionInput;

async function create(user: RegisteredUser, body: CreatePromotionInput, restaurantId = user.restaurantId): Promise<PromotionDto> {
  const res = await api.post(`/api/admin/restaurants/${restaurantId}/promotions`).set(bearer(user.accessToken)).send(body);
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as PromotionDto;
}

describe('promotions (admin)', () => {
  it('creates every template, lists newest-by-priority and validates the content per template', async () => {
    const owner = await registerUser();
    const category = await createCategory(owner, { name: { sr: 'Kokteli' } });
    const negroni = await createItem(owner, { categoryId: category.id, name: { sr: 'Negroni' }, priceCents: 90000 });

    const list = await create(owner, {
      title: 'Cocktail Menu',
      template: 'drink_list',
      display: 'banner',
      accentColor: '#E8453C',
      priority: 5,
      content: { logoText: 'Bar', columns: 2, entries: [{ name: 'Negroni', lines: ['Gin', 'Campari'], menuItemId: negroni.id }] },
    });
    expect(list.template).toBe('drink_list');
    expect(list.isActiveNow).toBe(true);
    expect(list.accentColor).toBe('#E8453C');
    const featured = await create(owner, { title: 'Try', template: 'featured_items', content: { items: [{ menuItemId: negroni.id, badge: 'New' }] } });
    const notice = await create(owner, { title: 'Hours', template: 'notice', display: 'modal', content: { headline: 'Closed Monday', body: 'See you Tuesday.' } });
    const dealPromo = await create(owner, deal({ isActive: false }));
    expect(dealPromo.isActiveNow).toBe(false);
    expect(dealPromo.display).toBe('card');

    const listed = await api.get(`/api/admin/restaurants/${owner.restaurantId}/promotions`).set(bearer(owner.accessToken));
    expect(listed.status).toBe(200);
    expect((listed.body as PromotionDto[]).map((p) => p.id)).toEqual([list.id, dealPromo.id, notice.id, featured.id]);

    // Content that does not fit the template, a foreign item and a bad recurrence are rejected.
    const wrong = await api.post(`/api/admin/restaurants/${owner.restaurantId}/promotions`).set(bearer(owner.accessToken)).send({ title: 'x', template: 'notice', content: { headline: 'only' } });
    expect(wrong.status).toBe(400);
    const tooMany = await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/promotions`)
      .set(bearer(owner.accessToken))
      .send({ title: 'x', template: 'featured_items', content: { items: [1, 2, 3, 4].map(() => ({ menuItemId: negroni.id })) } });
    expect(tooMany.status).toBe(400);
    const badWindow = await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/promotions`)
      .set(bearer(owner.accessToken))
      .send(deal({ recurrence: { weekdays: [8], from: '10:00', to: '12:00' } }));
    expect(badWindow.status).toBe(400);
    const backwards = await api
      .post(`/api/admin/restaurants/${owner.restaurantId}/promotions`)
      .set(bearer(owner.accessToken))
      .send(deal({ startsAt: '2026-12-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z' }));
    expect(backwards.status).toBe(400);
  });

  it('reads, patches, toggles and deletes through both route forms, with an audit trail', async () => {
    const owner = await registerUser();
    const promo = await create(owner, deal());
    const scoped = `/api/admin/restaurants/${owner.restaurantId}/promotions/${promo.id}`;
    const byId = `/api/admin/promotions/${promo.id}`;

    for (const path of [scoped, byId]) {
      const read = await api.get(path).set(bearer(owner.accessToken));
      expect(read.status).toBe(200);
      expect(read.body.id).toBe(promo.id);
    }

    const patched = await api
      .patch(byId)
      .set(bearer(owner.accessToken))
      .send({ title: 'Happy hour', priority: 3, recurrence: { weekdays: [1, 2, 3, 4, 5], from: '16:00', to: '18:00' }, style: { textColor: '#FFFFFF', backgroundColor: '#1F1A17', pillPosition: 'left' } });
    expect(patched.status).toBe(200);
    expect(patched.body.style).toEqual({ textColor: '#FFFFFF', backgroundColor: '#1F1A17', pillPosition: 'left' });
    expect(patched.body.title).toBe('Happy hour');
    expect(patched.body.recurrence).toEqual({ weekdays: [1, 2, 3, 4, 5], from: '16:00', to: '18:00' });
    expect(patched.body.template).toBe('deal');

    // A template switch carries its content; content without a template is a 400.
    const switched = await api.patch(scoped).set(bearer(owner.accessToken)).send({ template: 'notice', content: { headline: 'Hi', body: 'There' } });
    expect(switched.status).toBe(200);
    expect(switched.body.content).toEqual({ headline: 'Hi', body: 'There' });
    const orphan = await api.patch(scoped).set(bearer(owner.accessToken)).send({ content: { headline: 'Hi', body: 'There' } });
    expect(orphan.status).toBe(400);

    const off = await api.patch(`${byId}/toggle`).set(bearer(owner.accessToken)).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);
    expect(off.body.isActiveNow).toBe(false);
    const on = await api.patch(`${scoped}/toggle`).set(bearer(owner.accessToken)).send({ isActive: true });
    expect(on.body.isActive).toBe(true);

    const deleted = await api.delete(byId).set(bearer(owner.accessToken));
    expect(deleted.status).toBe(204);
    expect(await Promotion.count({ where: { id: promo.id } })).toBe(0);
    const gone = await api.get(byId).set(bearer(owner.accessToken));
    expect(gone.status).toBe(404);

    const actions = (await AuditLog.findAll({ where: { restaurantId: owner.restaurantId, entityType: 'promotion' }, order: [['createdAt', 'ASC']] })).map((row) => row.action);
    expect(actions).toEqual(['promotion.create', 'promotion.update', 'promotion.update', 'promotion.toggle', 'promotion.toggle', 'promotion.delete']);
  });

  it('is owner-level for every change and service-level for reading', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const promo = await create(owner, deal());
    const base = `/api/admin/restaurants/${owner.restaurantId}/promotions`;

    expect((await api.get(base).set(bearer(staff.accessToken))).status).toBe(200);
    expect((await api.get(`/api/admin/promotions/${promo.id}`).set(bearer(staff.accessToken))).status).toBe(200);
    const denied = await api.post(base).set(bearer(staff.accessToken)).send(deal());
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('ROLE_REQUIRED');
    expect((await api.patch(`/api/admin/promotions/${promo.id}`).set(bearer(staff.accessToken)).send({ title: 'x' })).status).toBe(403);
    expect((await api.patch(`${base}/${promo.id}/toggle`).set(bearer(staff.accessToken)).send({ isActive: false })).status).toBe(403);
    expect((await api.delete(`/api/admin/promotions/${promo.id}`).set(bearer(staff.accessToken))).status).toBe(403);
  });

  it("keeps tenants apart: a member of venue A cannot read or edit venue B's promotions", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const promoB = await create(b, deal({ title: 'B only' }));
    const categoryB = await createCategory(b, { name: { sr: 'Kafa' } });
    const itemB = await createItem(b, { categoryId: categoryB.id, name: { sr: 'Espresso' }, priceCents: 18000 });

    // The by-id routes resolve the venue from the row and then run the membership check.
    const read = await api.get(`/api/admin/promotions/${promoB.id}`).set(bearer(a.accessToken));
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');
    expect((await api.patch(`/api/admin/promotions/${promoB.id}`).set(bearer(a.accessToken)).send({ title: 'Hacked' })).status).toBe(403);
    expect((await api.patch(`/api/admin/promotions/${promoB.id}/toggle`).set(bearer(a.accessToken)).send({ isActive: false })).status).toBe(403);
    expect((await api.delete(`/api/admin/promotions/${promoB.id}`).set(bearer(a.accessToken))).status).toBe(403);

    // Under A's own venue B's promotion id does not exist, and B's venue is off limits.
    expect((await api.get(`/api/admin/restaurants/${a.restaurantId}/promotions/${promoB.id}`).set(bearer(a.accessToken))).status).toBe(404);
    expect((await api.patch(`/api/admin/restaurants/${a.restaurantId}/promotions/${promoB.id}`).set(bearer(a.accessToken)).send({ title: 'x' })).status).toBe(404);
    expect((await api.get(`/api/admin/restaurants/${b.restaurantId}/promotions`).set(bearer(a.accessToken))).status).toBe(403);
    expect((await api.post(`/api/admin/restaurants/${b.restaurantId}/promotions`).set(bearer(a.accessToken)).send(deal())).status).toBe(403);

    // Content may only reference the venue's own items.
    const foreign = await api
      .post(`/api/admin/restaurants/${a.restaurantId}/promotions`)
      .set(bearer(a.accessToken))
      .send({ title: 'x', template: 'featured_items', content: { items: [{ menuItemId: itemB.id }] } });
    expect(foreign.status).toBe(404);

    const unchanged = await api.get(`/api/admin/promotions/${promoB.id}`).set(bearer(b.accessToken));
    expect(unchanged.body.title).toBe('B only');
    expect(unchanged.body.isActive).toBe(true);
  });
});

describe('promotions (public)', () => {
  it('returns only active-now promotions, at most one modal, with the referenced items resolved', async () => {
    const owner = await registerUser({ restaurantName: 'Bar Promo' });
    const slug = owner.memberships[0]!.restaurant.slug;
    const category = await createCategory(owner, { name: { sr: 'Kokteli', en: 'Cocktails' } });
    const negroni = await createItem(owner, { categoryId: category.id, name: { sr: 'Negroni' }, description: { sr: 'Gin, Campari', en: 'Gin, Campari' }, priceCents: 90000 });
    const gone = await createItem(owner, { categoryId: category.id, name: { sr: 'Nema', en: 'Gone' }, priceCents: 100, isAvailable: false });

    const unpublished = await api.get(`/api/public/${slug}/promotions`);
    expect(unpublished.status).toBe(404);
    await publish(owner);

    const banner = await create(owner, {
      title: 'Cocktail Menu',
      template: 'drink_list',
      display: 'banner',
      priority: 10,
      style: { backgroundColor: '#FFF4E6' },
      content: { columns: 2, variant: 'simple', icons: 'none', entries: [{ name: 'Negroni', lines: ['Gin'], menuItemId: negroni.id }, { name: 'Gone', lines: [], menuItemId: gone.id }] },
    });
    const lowModal = await create(owner, { title: 'Low modal', template: 'notice', display: 'modal', priority: 1, content: { headline: 'a', body: 'b' } });
    const highModal = await create(owner, { title: 'High modal', template: 'notice', display: 'modal', priority: 2, content: { headline: 'a', body: 'b' } });
    await create(owner, deal({ title: 'Off', isActive: false }));
    await create(owner, deal({ title: 'Tomorrow', startsAt: new Date(Date.now() + 86_400_000).toISOString() }));
    await create(owner, deal({ title: 'Yesterday', endsAt: new Date(Date.now() - 86_400_000).toISOString() }));
    const card = await create(owner, { title: 'Try it', template: 'featured_items', display: 'card', content: { items: [{ menuItemId: negroni.id, badge: 'NEW' }] } });

    const res = await api.get(`/api/public/r/${slug}/promotions?locale=en`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    const promos = res.body as PublicPromotionDto[];
    expect(promos.map((p) => p.title)).toEqual(['Cocktail Menu', 'High modal', 'Try it']);
    expect(promos.find((p) => p.id === lowModal.id)).toBeUndefined();
    expect(promos[0]!.id).toBe(banner.id);
    expect(promos[0]!.style).toEqual({ backgroundColor: '#FFF4E6' });
    expect(promos[0]!.content).toMatchObject({ variant: 'simple', icons: 'none' });
    expect(promos[1]!.id).toBe(highModal.id);
    expect(promos[0]!.items).toEqual([
      { id: negroni.id, name: 'Negroni', description: 'Gin, Campari', priceCents: 90000, imageUrl: null, thumbnailUrl: null, isAvailable: true },
      { id: gone.id, name: 'Gone', description: null, priceCents: 100, imageUrl: null, thumbnailUrl: null, isAvailable: false },
    ]);
    expect(promos[2]!.id).toBe(card.id);
    expect(promos[2]!.items[0]!.name).toBe('Negroni');
    // The admin-only fields stay private.
    expect(promos[0]).not.toHaveProperty('isActive');
    expect(promos[0]).not.toHaveProperty('restaurantId');

    // The two other public forms answer the same.
    const explicit = await api.get(`/api/public/${slug}/promotions`);
    expect(explicit.status).toBe(200);
    expect((explicit.body as PublicPromotionDto[]).length).toBe(3);
    const hosted = await api.get('/api/public/promotions').set('Host', `${slug}.localhost:5174`);
    expect(hosted.status).toBe(200);
    expect((hosted.body as PublicPromotionDto[]).length).toBe(3);
  });
});
