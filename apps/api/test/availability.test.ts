import { describe, expect, it } from 'vitest';
import { nextOccurrenceOfTime, zonedParts } from '../src/utils/time.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

describe('nextOccurrenceOfTime', () => {
  const tz = 'Europe/Belgrade';

  it('returns today at 06:00 when that is still ahead', () => {
    const now = new Date('2026-10-20T02:00:00Z'); // 04:00 CEST
    expect(nextOccurrenceOfTime(6, 0, tz, now).toISOString()).toBe('2026-10-20T04:00:00.000Z');
  });

  it('returns tomorrow at 06:00 once today\'s has passed', () => {
    const now = new Date('2026-10-20T10:00:00Z'); // 12:00 CEST
    expect(nextOccurrenceOfTime(6, 0, tz, now).toISOString()).toBe('2026-10-21T04:00:00.000Z');
  });

  it('handles the DST switch (CEST → CET on 2026-10-25)', () => {
    const now = new Date('2026-10-24T20:00:00Z'); // Saturday 22:00 CEST
    expect(nextOccurrenceOfTime(6, 0, tz, now).toISOString()).toBe('2026-10-25T05:00:00.000Z');
  });

  it('works for zones west of UTC', () => {
    const now = new Date('2026-10-20T12:00:00Z'); // 08:00 in New York (EDT)
    const next = nextOccurrenceOfTime(6, 0, 'America/New_York', now);
    expect(next.toISOString()).toBe('2026-10-21T10:00:00.000Z');
  });
});

describe('PATCH /items/:id/availability', () => {
  async function setup() {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 18000 });
    await publish(owner);
    const url = `/api/admin/restaurants/${owner.restaurantId}/items/${item.id}/availability`;
    const slug = owner.memberships[0]!.restaurant.slug;
    const set = (body: object) => api.patch(url).set(bearer(owner.accessToken)).send(body);
    return { owner, item, set, slug };
  }

  it('marks an item unavailable indefinitely and back', async () => {
    const { set, slug } = await setup();
    const off = await set({ available: false });
    expect(off.status).toBe(200);
    expect(off.body.isAvailable).toBe(false);
    expect(off.body.unavailableUntil).toBeNull();
    expect(off.body.isEffectivelyAvailable).toBe(false);

    const menu = await api.get(`/api/public/${slug}/menu`);
    expect(menu.body.categories[0].items[0].isAvailable).toBe(false);

    const on = await set({ available: true });
    expect(on.body.isAvailable).toBe(true);
    expect(on.body.isEffectivelyAvailable).toBe(true);
  });

  it('uses unavailable_until for temporary unavailability', async () => {
    const { set } = await setup();
    const future = new Date(Date.now() + 3 * 3600_000).toISOString();
    const res = await set({ available: false, until: future });
    expect(res.status).toBe(200);
    expect(res.body.isAvailable).toBe(true);
    expect(res.body.unavailableUntil).toBe(future);
    expect(res.body.isEffectivelyAvailable).toBe(false);

    const past = new Date(Date.now() - 3600_000).toISOString();
    const expired = await set({ available: false, until: past });
    expect(expired.body.isEffectivelyAvailable).toBe(true);

    const cleared = await set({ available: true });
    expect(cleared.body.unavailableUntil).toBeNull();
  });

  it("resolves 'tomorrow-06:00' in the restaurant's time zone", async () => {
    const { owner, set } = await setup();
    const before = Date.now();
    const res = await set({ available: false, until: 'tomorrow-06:00' });
    expect(res.status).toBe(200);
    const until = new Date(res.body.unavailableUntil);
    expect(until.getTime()).toBeGreaterThan(before);
    expect(until.getTime() - before).toBeLessThanOrEqual(24 * 3600_000);
    expect(zonedParts(until, 'Europe/Belgrade')).toMatchObject({ hour: 6, minute: 0 });
    expect(res.body.isEffectivelyAvailable).toBe(false);

    await api
      .patch(`/api/admin/restaurants/${owner.restaurantId}`)
      .set(bearer(owner.accessToken))
      .send({ timezone: 'America/New_York' });
    const ny = await set({ available: false, until: 'tomorrow-06:00' });
    expect(zonedParts(new Date(ny.body.unavailableUntil), 'America/New_York')).toMatchObject({ hour: 6, minute: 0 });
  });

  it('rejects invalid until values', async () => {
    const { set } = await setup();
    const res = await set({ available: false, until: 'next-week' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
