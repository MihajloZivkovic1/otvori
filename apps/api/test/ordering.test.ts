import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { OrderDto, PublicOrderDto, ServiceRequestDto, TableDto } from '@qr-menu/shared';
import { Membership, Order } from '../src/db/models/index.js';
import { expireStaleOrders } from '../src/modules/ordering/service.js';
import { api, bearer, createCategory, createItem, publish, registerUser, type RegisteredUser } from './helpers.js';

const session = () => ({ 'X-Session-Id': randomUUID() });

/** Owner + published restaurant in `order` mode with one table and three items (one with variants, one unavailable). */
async function setupOrdering(mode: 'order' | 'call_waiter' | 'off' = 'order') {
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const coffee = await createCategory(owner, { name: { sr: 'Kafa', en: 'Coffee' } });
  const hidden = await createCategory(owner, { name: { sr: 'Sezonsko' }, isHidden: true });
  const espresso = await createItem(owner, {
    categoryId: coffee.id,
    name: { sr: 'Espreso', en: 'Espresso' },
    priceCents: 18000,
    variants: [
      { name: 'Single', priceCents: 18000 },
      { name: 'Double', priceCents: 22000 },
    ],
  });
  const cortado = await createItem(owner, { categoryId: coffee.id, name: { sr: 'Kortado' }, priceCents: 24000 });
  const gone = await createItem(owner, { categoryId: coffee.id, name: { sr: 'Nema' }, priceCents: 100, isAvailable: false });
  const seasonal = await createItem(owner, { categoryId: hidden.id, name: { sr: 'Bundeva' }, priceCents: 300 });
  const tableRes = await api.post(`${admin}/tables`).set(bearer(owner.accessToken)).send({ number: 7, label: 'Bašta 1' });
  const table = tableRes.body as TableDto;
  await api.patch(admin).set(bearer(owner.accessToken)).send({ orderingMode: mode, modules: { ordering: true } });
  await publish(owner);
  const double = espresso.variants.find((v) => v.name === 'Double')!;
  return { owner, slug, admin, espresso, double, cortado, gone, seasonal, table };
}

const basket = (ctx: Awaited<ReturnType<typeof setupOrdering>>) => ({
  tableNumber: 7,
  items: [
    { itemId: ctx.espresso.id, variantId: ctx.double.id, quantity: 2, note: 'bez šećera' },
    { itemId: ctx.cortado.id, quantity: 1 },
  ],
  note: 'Sve odjednom, molim.',
  guestName: 'Marko',
  locale: 'en',
});

describe('guest orders', () => {
  it('snapshots names and prices, numbers orders per day and computes the total server-side', async () => {
    const ctx = await setupOrdering();
    const guest = session();
    const res = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send({ ...basket(ctx), totalCents: 1 });
    expect(res.status).toBe(201);
    const order = res.body as PublicOrderDto;
    expect(order.number).toBe(1);
    expect(order.status).toBe('new');
    expect(order.tableNumber).toBe(7);
    expect(order.totalCents).toBe(2 * 22000 + 24000);
    expect(order.locale).toBe('en');
    expect(order.guestName).toBe('Marko');
    expect(order.note).toBe('Sve odjednom, molim.');
    expect(order.expiresAt).toBeTypeOf('string');
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({ name: 'Espresso', variantName: 'Double', unitPriceCents: 22000, quantity: 2, lineTotalCents: 44000, lineNote: 'bez šećera' });
    expect(order.items[1]).toMatchObject({ name: 'Kortado', variantName: null, unitPriceCents: 24000, quantity: 1, lineNote: null });

    // Staff see the raw snapshot in both locales, and the price stays even after the menu changes.
    await api.patch(`${ctx.admin}/items/${ctx.cortado.id}`).set(bearer(ctx.owner.accessToken)).send({ priceCents: 99900, name: { sr: 'Skupi kortado' } });
    const list = await api.get(`${ctx.admin}/orders`).set(bearer(ctx.owner.accessToken));
    expect(list.status).toBe(200);
    const staff = list.body as OrderDto[];
    expect(staff).toHaveLength(1);
    expect(staff[0]!.items[0]!.name).toEqual({ sr: 'Espreso', en: 'Espresso' });
    expect(staff[0]!.items[1]!.unitPriceCents).toBe(24000);
    expect(staff[0]!.tableId).toBe(ctx.table.id);

    const second = await api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(basket(ctx));
    expect(second.body.number).toBe(2);
    expect(second.body.totalCents).toBe(2 * 22000 + 99900);

    const bySession = await api.get(`/api/public/${ctx.slug}/orders/${order.id}`).set(guest);
    expect(bySession.status).toBe(200);
    expect(bySession.headers['cache-control']).toBe('no-store');
    const otherSession = await api.get(`/api/public/${ctx.slug}/orders/${order.id}`).set(session());
    expect(otherSession.status).toBe(404);
    const noSession = await api.get(`/api/public/${ctx.slug}/orders/${order.id}`);
    expect(noSession.status).toBe(400);
    expect(noSession.body.error.code).toBe('SESSION_REQUIRED');
  });

  it('validates lines against the live menu', async () => {
    const ctx = await setupOrdering();
    const post = (body: object) => api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(body);

    const unknownItem = await post({ tableNumber: 7, items: [{ itemId: randomUUID(), quantity: 1 }] });
    expect(unknownItem.status).toBe(400);
    expect(unknownItem.body.error.details[0].path).toBe('items.0.itemId');

    const hiddenItem = await post({ tableNumber: 7, items: [{ itemId: ctx.seasonal.id, quantity: 1 }] });
    expect(hiddenItem.status).toBe(400);

    const missingVariant = await post({ tableNumber: 7, items: [{ itemId: ctx.espresso.id, quantity: 1 }] });
    expect(missingVariant.status).toBe(400);
    expect(missingVariant.body.error.details[0].path).toBe('items.0.variantId');

    const foreignVariant = await post({ tableNumber: 7, items: [{ itemId: ctx.cortado.id, variantId: ctx.double.id, quantity: 1 }] });
    expect(foreignVariant.status).toBe(400);

    const unavailable = await post({ tableNumber: 7, items: [{ itemId: ctx.gone.id, quantity: 1 }] });
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.error.code).toBe('ITEM_UNAVAILABLE');
    expect(unavailable.body.error.details.itemIds).toEqual([ctx.gone.id]);

    const tooMany = await post({ tableNumber: 7, items: [{ itemId: ctx.cortado.id, quantity: 21 }] });
    expect(tooMany.status).toBe(400);

    const longNote = await post({ tableNumber: 7, items: [{ itemId: ctx.cortado.id, quantity: 1 }], note: 'x'.repeat(201) });
    expect(longNote.status).toBe(400);

    const noTable = await post({ tableNumber: 99, items: [{ itemId: ctx.cortado.id, quantity: 1 }] });
    expect(noTable.status).toBe(404);
    expect(noTable.body.error.code).toBe('TABLE_NOT_FOUND');

    expect(await Order.count()).toBe(0);
  });

  it('is gated by orderingMode and orderingPaused', async () => {
    const ctx = await setupOrdering('call_waiter');
    const post = () => api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(basket(ctx));
    const off = await post();
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('ORDERING_DISABLED');

    await api.patch(ctx.admin).set(bearer(ctx.owner.accessToken)).send({ orderingMode: 'order', orderingPaused: true, pausedMessage: 'Kuhinja je zatvorena do 17:00.' });
    const menu = await api.get(`/api/public/${ctx.slug}/menu`);
    expect(menu.body.restaurant).toMatchObject({ orderingMode: 'order', orderingPaused: true, pausedMessage: 'Kuhinja je zatvorena do 17:00.' });
    const paused = await post();
    expect(paused.status).toBe(409);
    expect(paused.body.error.code).toBe('ORDERING_PAUSED');
    expect(paused.body.error.message).toBe('Kuhinja je zatvorena do 17:00.');

    // Calls still work while paused …
    const call = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'call_waiter', tableNumber: 7 });
    expect(call.status).toBe(201);

    // … but staff cannot change the ordering settings.
    const staff = await registerUser();
    await Membership.create({ userId: staff.user.id, restaurantId: ctx.owner.restaurantId, role: 'staff' });
    const denied = await api.patch(ctx.admin).set(bearer(staff.accessToken)).send({ orderingPaused: false });
    expect(denied.status).toBe(403);

    await api.patch(ctx.admin).set(bearer(ctx.owner.accessToken)).send({ orderingPaused: false });
    expect((await post()).status).toBe(201);
  });

  it('caps open orders per session at 3 and frees a slot when one closes', async () => {
    const ctx = await setupOrdering();
    const guest = session();
    const post = () => api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const first = await post();
    expect(first.status).toBe(201);
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    const fourth = await post();
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe('TOO_MANY_OPEN_ORDERS');

    const cancelled = await api.post(`/api/public/${ctx.slug}/orders/${first.body.id}/cancel`).set(guest);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.closedAt).toBeTypeOf('string');
    expect((await post()).status).toBe(201);

    // Another session is not affected by this one's limit.
    expect((await api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(basket(ctx))).status).toBe(201);
  });

  it('refuses orders and calls from a blocked table until the block ends', async () => {
    const ctx = await setupOrdering();
    const blocked = await api.post(`${ctx.admin}/tables/${ctx.table.id}/block`).set(bearer(ctx.owner.accessToken));
    expect(blocked.status).toBe(200);
    expect(new Date(blocked.body.blockedUntil).getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);

    const order = await api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(basket(ctx));
    expect(order.status).toBe(423);
    expect(order.body.error.code).toBe('TABLE_BLOCKED');
    expect(order.body.error.message).toMatch(/call the waiter/i);
    const call = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'bill', tableNumber: 7 });
    expect(call.status).toBe(423);

    const tables = await api.get(`${ctx.admin}/tables`).set(bearer(ctx.owner.accessToken));
    expect(tables.body[0].blockedUntil).toBeTypeOf('string');

    const unblocked = await api.delete(`${ctx.admin}/tables/${ctx.table.id}/block`).set(bearer(ctx.owner.accessToken));
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.blockedUntil).toBeNull();
    expect((await api.post(`/api/public/${ctx.slug}/orders`).set(session()).send(basket(ctx))).status).toBe(201);
  });
});

describe('staff order handling', () => {
  it('walks new → accepted → delivered and rejects illegal transitions', async () => {
    const ctx = await setupOrdering();
    const guest = session();
    const created = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const id = created.body.id as string;
    const patch = (body: object, who: RegisteredUser = ctx.owner) =>
      api.patch(`${ctx.admin}/orders/${id}`).set(bearer(who.accessToken)).send(body);

    const skip = await patch({ status: 'delivered' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');

    const badBody = await patch({ status: 'accepted', rejectedReason: 'no' });
    expect(badBody.status).toBe(400);
    const notForStaff = await patch({ status: 'cancelled' });
    expect(notForStaff.status).toBe(400);

    const accepted = await patch({ status: 'accepted' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('accepted');
    expect(accepted.body.acceptedAt).toBeTypeOf('string');
    expect(accepted.body.expiresAt).toBeNull();

    // The guest cannot cancel any more; staff cannot accept twice.
    const lateCancel = await api.post(`/api/public/${ctx.slug}/orders/${id}/cancel`).set(guest);
    expect(lateCancel.status).toBe(409);
    expect((await patch({ status: 'accepted' })).status).toBe(409);

    // Staff (not only owners) can deliver.
    const staff = await registerUser();
    await Membership.create({ userId: staff.user.id, restaurantId: ctx.owner.restaurantId, role: 'staff' });
    const delivered = await patch({ status: 'delivered' }, staff);
    expect(delivered.status).toBe(200);
    expect(delivered.body.deliveredAt).toBeTypeOf('string');
    expect(delivered.body.closedAt).toBeTypeOf('string');
    expect((await patch({ status: 'rejected', rejectedReason: 'late' })).status).toBe(409);

    const guestView = await api.get(`/api/public/${ctx.slug}/orders/${id}`).set(guest);
    expect(guestView.body.status).toBe('delivered');
  });

  it('shows the rejection reason to the guest and lists by status', async () => {
    const ctx = await setupOrdering();
    const guest = session();
    const a = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const b = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const rejected = await api
      .patch(`${ctx.admin}/orders/${a.body.id}`)
      .set(bearer(ctx.owner.accessToken))
      .send({ status: 'rejected', rejectedReason: 'Šakšuka je rasprodata za danas.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.rejectedReason).toBe('Šakšuka je rasprodata za danas.');

    const guestView = await api.get(`/api/public/${ctx.slug}/orders/${a.body.id}`).set(guest);
    expect(guestView.body.status).toBe('rejected');
    expect(guestView.body.rejectedReason).toBe('Šakšuka je rasprodata za danas.');

    const open = await api.get(`${ctx.admin}/orders?status=new,accepted`).set(bearer(ctx.owner.accessToken));
    expect(open.body.map((o: OrderDto) => o.id)).toEqual([b.body.id]);
    const closed = await api.get(`${ctx.admin}/orders?status=rejected`).set(bearer(ctx.owner.accessToken));
    expect(closed.body.map((o: OrderDto) => o.id)).toEqual([a.body.id]);
    const all = await api.get(`${ctx.admin}/orders`).set(bearer(ctx.owner.accessToken));
    expect(all.body).toHaveLength(2);
    const bad = await api.get(`${ctx.admin}/orders?status=bogus`).set(bearer(ctx.owner.accessToken));
    expect(bad.status).toBe(400);
  });

  it('expires stale new orders (job and lazy read) and leaves accepted ones alone', async () => {
    const ctx = await setupOrdering();
    const guest = session();
    const stale = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const fresh = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    const taken = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send(basket(ctx));
    await api.patch(`${ctx.admin}/orders/${taken.body.id}`).set(bearer(ctx.owner.accessToken)).send({ status: 'accepted' });
    const old = new Date(Date.now() - 25 * 60_000);
    await Order.update({ createdAt: old }, { where: { id: [stale.body.id, taken.body.id] }, silent: true });

    expect(await expireStaleOrders()).toBe(1);
    expect(await expireStaleOrders()).toBe(0);
    const expired = await api.get(`/api/public/${ctx.slug}/orders/${stale.body.id}`).set(guest);
    expect(expired.body.status).toBe('expired');
    expect(expired.body.closedAt).toBeTypeOf('string');
    expect((await api.get(`/api/public/${ctx.slug}/orders/${fresh.body.id}`).set(guest)).body.status).toBe('new');
    expect((await api.get(`/api/public/${ctx.slug}/orders/${taken.body.id}`).set(guest)).body.status).toBe('accepted');

    // A guest polling before the next job run still sees the truth.
    await Order.update({ createdAt: old }, { where: { id: fresh.body.id }, silent: true });
    const lazy = await api.get(`/api/public/${ctx.slug}/orders/${fresh.body.id}`).set(guest);
    expect(lazy.body.status).toBe('expired');
    expect((await api.post(`/api/public/${ctx.slug}/orders/${fresh.body.id}/cancel`).set(guest)).status).toBe(409);

    const analytics = await api.get(`${ctx.admin}/analytics?range=7d`).set(bearer(ctx.owner.accessToken));
    expect(analytics.status).toBe(200);
    expect(analytics.body.ordering.orders.value).toBe(3);
    expect(analytics.body.ordering.acceptedRate.value).toBeCloseTo(33.3, 1);
    expect(analytics.body.ordering.medianAcceptSeconds).toBeTypeOf('number');
    expect(analytics.body.ordering.orderedRevenueCents.value).toBe(2 * 22000 + 24000);
  });

  it('keeps one open request per type and table and marks it done', async () => {
    const ctx = await setupOrdering();
    const first = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'call_waiter', tableNumber: 7 });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ type: 'call_waiter', status: 'open' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const again = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'call_waiter', tableNumber: 7 });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(new Date(again.body.updatedAt).getTime()).toBeGreaterThan(new Date(first.body.updatedAt).getTime());
    const bill = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'bill', tableNumber: 7 });
    expect(bill.status).toBe(201);
    expect((await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'bill', tableNumber: 42 })).status).toBe(404);

    const open = await api.get(`${ctx.admin}/requests?status=open`).set(bearer(ctx.owner.accessToken));
    expect(open.status).toBe(200);
    expect(open.body.map((r: ServiceRequestDto) => r.type)).toEqual(['call_waiter', 'bill']);
    expect(open.body[0].tableNumber).toBe(7);

    const done = await api.patch(`${ctx.admin}/requests/${first.body.id}`).set(bearer(ctx.owner.accessToken)).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('done');
    expect(done.body.doneAt).toBeTypeOf('string');
    expect((await api.patch(`${ctx.admin}/requests/${first.body.id}`).set(bearer(ctx.owner.accessToken)).send({ status: 'done' })).status).toBe(200);
    expect((await api.patch(`${ctx.admin}/requests/${first.body.id}`).set(bearer(ctx.owner.accessToken)).send({ status: 'open' })).status).toBe(400);

    const stillOpen = await api.get(`${ctx.admin}/requests?status=open`).set(bearer(ctx.owner.accessToken));
    expect(stillOpen.body.map((r: ServiceRequestDto) => r.id)).toEqual([bill.body.id]);
    // A new call after "done" starts a fresh request.
    const third = await api.post(`/api/public/${ctx.slug}/requests`).set(session()).send({ type: 'call_waiter', tableNumber: 7 });
    expect(third.status).toBe(201);
    expect(third.body.id).not.toBe(first.body.id);
  });

  it('keeps orders and requests inside their restaurant', async () => {
    const a = await setupOrdering();
    const b = await setupOrdering();
    const order = await api.post(`/api/public/${a.slug}/orders`).set(session()).send(basket(a));
    const request = await api.post(`/api/public/${a.slug}/requests`).set(session()).send({ type: 'bill', tableNumber: 7 });

    const list = await api.get(`${a.admin}/orders`).set(bearer(b.owner.accessToken));
    expect(list.status).toBe(403);
    const crossPatch = await api.patch(`${b.admin}/orders/${order.body.id}`).set(bearer(b.owner.accessToken)).send({ status: 'accepted' });
    expect(crossPatch.status).toBe(404);
    const crossRequest = await api.patch(`${b.admin}/requests/${request.body.id}`).set(bearer(b.owner.accessToken)).send({ status: 'done' });
    expect(crossRequest.status).toBe(404);
    const crossBlock = await api.post(`${b.admin}/tables/${a.table.id}/block`).set(bearer(b.owner.accessToken));
    expect(crossBlock.status).toBe(404);
    const bOrders = await api.get(`${b.admin}/orders`).set(bearer(b.owner.accessToken));
    expect(bOrders.body).toEqual([]);
    // Guests cannot read an order through another restaurant's slug either.
    expect((await api.get(`/api/public/${b.slug}/orders/${order.body.id}`).set(session())).status).toBe(404);
  });
});
