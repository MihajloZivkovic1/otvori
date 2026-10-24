import { describe, expect, it } from 'vitest';
import { AuditLog, Membership, Order, Restaurant } from '../src/db/models/index.js';
import { countsFor, runDailyDigest } from '../src/modules/audit/digest.js';
import { pruneAuditLog } from '../src/modules/audit/service.js';
import { digestSummary, outbox } from '../src/utils/mailer.js';
import { addStaff, api, bearer, createCategory, createItem, login, registerUser, setPinAndUnlock } from './helpers.js';

describe('audit log (Phase 11)', () => {
  it('records owner actions with who / role / elevated and a before-after diff for prices', async () => {
    const owner = await registerUser({ name: 'Ana' });
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espresso' }, priceCents: 18000 });
    const headers = await setPinAndUnlock(owner);
    const edit = await api.patch(`${base}/items/${item.id}`).set(headers).send({ priceCents: 19000, description: { sr: 'Nova' } });
    expect(edit.status).toBe(200);
    // Same payload again: nothing changed, nothing logged.
    await api.patch(`${base}/items/${item.id}`).set(headers).send({ priceCents: 19000 });

    const list = await api.get(`${base}/audit-log?kind=prices`).set(headers);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2); // the create and the price change
    const change = list.body.items.find((e: { action: string }) => e.action === 'item.update');
    expect(change).toMatchObject({
      user: { id: owner.user.id, name: 'Ana', email: owner.email },
      role: 'owner',
      elevated: true,
      entityType: 'item',
      entityId: item.id,
      entityLabel: 'Espresso',
      before: { priceCents: 18000, description: null },
      after: { priceCents: 19000, description: { sr: 'Nova' } },
      priceChange: true,
    });
    expect(change.ip).toBeTruthy();
    expect(list.body.users).toEqual([{ id: owner.user.id, name: 'Ana' }]);

    const everything = await api.get(`${base}/audit-log`).set(headers);
    expect(everything.body.items.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(['category.create', 'item.create', 'item.update', 'auth.pin_set', 'auth.pin_unlock']),
    );
    const byAction = await api.get(`${base}/audit-log?action=item.create`).set(headers);
    expect(byAction.body.total).toBe(1);
    const nobody = await api.get(`${base}/audit-log?userId=00000000-0000-4000-8000-000000000000`).set(headers);
    expect(nobody.body.total).toBe(0);
  });

  it('is a shift record: availability, sign-ins and order actions carry the acting member, not elevated', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    await api.patch(base).set(bearer(owner.accessToken)).send({ modules: { ordering: true }, orderingMode: 'order' });
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espresso' }, priceCents: 18000 });
    const staffSession = await login(staff.email, staff.password);
    await api.patch(`${base}/items/${item.id}/availability`).set(bearer(staffSession.accessToken)).send({ available: false, until: 'tomorrow-06:00' });

    const restaurant = (await Restaurant.findByPk(owner.restaurantId))!;
    const order = await Order.create({ restaurantId: restaurant.id, tableNumber: 4, sessionId: '11111111-1111-4111-8111-111111111111', status: 'new', number: 7, totalCents: 36000, locale: 'sr' });
    const accepted = await api.patch(`${base}/orders/${order.id}`).set(bearer(staffSession.accessToken)).send({ status: 'accepted' });
    expect(accepted.status).toBe(200);
    const delivered = await api.patch(`${base}/orders/${order.id}`).set(bearer(staffSession.accessToken)).send({ status: 'delivered' });
    expect(delivered.status).toBe(200);

    const rows = await AuditLog.findAll({ where: { restaurantId: owner.restaurantId, userId: staff.user.id }, order: [['createdAt', 'ASC']] });
    expect(rows.map((r) => r.action)).toEqual(['auth.login', 'item.availability', 'order.accept', 'order.deliver']);
    expect(rows.every((r) => r.role === 'staff' && !r.elevated)).toBe(true);
    expect(rows[1]!.before).toMatchObject({ isAvailable: true, unavailableUntil: null });
    expect(rows[1]!.after).toMatchObject({ isAvailable: true });
    expect(rows[1]!.after!.unavailableUntil).toBeTruthy();
    expect(rows[2]!.entityLabel).toBe('#7');
    expect(rows[2]!.after).toMatchObject({ status: 'accepted', tableNumber: 4, totalCents: 36000 });

    const asStaff = await api.get(`${base}/audit-log`).set(bearer(staffSession.accessToken));
    expect(asStaff.status).toBe(403);
    const byUser = await api.get(`${base}/audit-log?userId=${staff.user.id}&kind=orders`).set(bearer(owner.accessToken));
    expect(byUser.body.items.map((e: { action: string }) => e.action)).toEqual(['order.deliver', 'order.accept']);
  });

  it('keeps 90 days', async () => {
    const owner = await registerUser();
    await createCategory(owner, { name: { sr: 'Kafa' } });
    const old = await AuditLog.create({ restaurantId: owner.restaurantId, action: 'item.update' });
    await AuditLog.update({ createdAt: new Date(Date.now() - 91 * 86_400_000) }, { where: { id: old.id } });
    const before = await AuditLog.count({ where: { restaurantId: owner.restaurantId } });
    const deleted = await pruneAuditLog();
    expect(deleted).toBe(1);
    expect(await AuditLog.count({ where: { restaurantId: owner.restaurantId } })).toBe(before - 1);
  });

  it('sends the daily digest once per venue after 07:00 local time to members who opted in', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espresso' }, priceCents: 18000 });
    await api.patch(`${base}/items/${item.id}`).set(bearer(owner.accessToken)).send({ priceCents: 19000 });
    await api.patch(`${base}/items/${item.id}`).set(bearer(owner.accessToken)).send({ priceCents: 20000 });
    await api.patch(`${base}/items/${item.id}`).set(bearer(owner.accessToken)).send({ priceCents: 21000 });
    await createItem(owner, { categoryId: category.id, name: { sr: 'Latte' }, priceCents: 25000 });
    await api.put(`${base}/security/pin`).set(bearer(owner.accessToken)).send({ pin: '2580', password: owner.password });
    await api.post(`${base}/security/unlock`).set(bearer(owner.accessToken)).send({ pin: '9517' });
    await api.post(`${base}/security/unlock`).set(bearer(owner.accessToken)).send({ pin: '9517' });

    // Everything above happened "yesterday" (Belgrade time) for the job.
    await AuditLog.update({ createdAt: new Date(Date.now() - 86_400_000) }, { where: { restaurantId: owner.restaurantId } });
    const counts = countsFor(await AuditLog.findAll({ where: { restaurantId: owner.restaurantId } }));
    expect(counts).toMatchObject({ priceChanges: 3, newItems: 2, pinFailures: 2 });
    expect(digestSummary(counts)).toBe('Juče: 3 promene cena, 2 nova artikla, 2 pogrešna PIN-a');

    // Nobody opted in yet: nothing goes out.
    const noon = new Date();
    noon.setUTCHours(11, 0, 0, 0);
    expect((await runDailyDigest(noon)).sent).toBe(0);

    const opted = await api.patch(`${base}/security`).set(bearer(owner.accessToken)).send({ dailyDigest: true });
    expect(opted.body.dailyDigest).toBe(true);
    expect((await Membership.findOne({ where: { userId: owner.user.id } }))!.dailyDigest).toBe(true);
    // The opt-in itself was logged today and must not leak into yesterday's numbers; before 07:00 nothing is sent.
    const early = new Date(noon);
    early.setUTCHours(3, 0, 0, 0);
    expect((await runDailyDigest(early)).sent).toBe(0);
    expect((await runDailyDigest(noon)).sent).toBe(1);
    const mail = outbox.find((m) => m.subject.startsWith('Kafeterija · Juče'));
    expect(mail?.to).toBe(owner.email);
    expect(mail?.subject).toBe('Kafeterija · Juče: 3 promene cena, 2 nova artikla, 2 pogrešna PIN-a');
    expect(mail?.text).toContain(`/r/${owner.restaurantId}/settings/history`);
    // Once per day.
    expect((await runDailyDigest(new Date(noon.getTime() + 3_600_000))).sent).toBe(0);
  });
});
