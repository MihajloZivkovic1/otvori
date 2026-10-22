import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OrderingEvent } from '@qr-menu/shared';
import { Membership } from '../src/db/models/index.js';
import { openStreamCount } from '../src/modules/ordering/sse.js';
import { api, app, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Stream {
  status: number;
  headers: http.IncomingHttpHeaders;
  /** Resolves with the first event of the given type (comments and pings are skipped). */
  next(type: OrderingEvent['type'], timeoutMs?: number): Promise<OrderingEvent>;
  close(): void;
}

/** Minimal SSE client: parses `event:`/`data:` blocks from the raw response body. */
function openStream(path: string): Promise<Stream> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${path}`, { headers: { Accept: 'text/event-stream' } }, (res) => {
      const queue: OrderingEvent[] = [];
      const waiters: { type: string; resolve: (event: OrderingEvent) => void }[] = [];
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        let index: number;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const data = block
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (!data) continue;
          const event = JSON.parse(data) as OrderingEvent;
          const waiter = waiters.findIndex((w) => w.type === event.type);
          if (waiter >= 0) waiters.splice(waiter, 1)[0]!.resolve(event);
          else queue.push(event);
        }
      });
      resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        next: (type, timeoutMs = 5000) =>
          new Promise((resolveEvent, rejectEvent) => {
            const queued = queue.findIndex((event) => event.type === type);
            if (queued >= 0) {
              resolveEvent(queue.splice(queued, 1)[0]!);
              return;
            }
            const timer = setTimeout(() => rejectEvent(new Error(`No ${type} event within ${timeoutMs} ms`)), timeoutMs);
            waiters.push({
              type,
              resolve: (event) => {
                clearTimeout(timer);
                resolveEvent(event);
              },
            });
          }),
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
  });
}

async function setup() {
  const owner = await registerUser({ restaurantName: 'Kafeterija' });
  const slug = owner.memberships[0]!.restaurant.slug;
  const admin = `/api/admin/restaurants/${owner.restaurantId}`;
  const coffee = await createCategory(owner, { name: { sr: 'Kafa' } });
  const item = await createItem(owner, { categoryId: coffee.id, name: { sr: 'Kortado' }, priceCents: 24000 });
  await api.post(`${admin}/tables`).set(bearer(owner.accessToken)).send({ number: 3 });
  await api.patch(admin).set(bearer(owner.accessToken)).send({ orderingMode: 'order', modules: { ordering: true } });
  await publish(owner);
  return { owner, slug, admin, item };
}

describe('ordering events (SSE)', () => {
  it('issues a stream token to members and delivers order and request events live', async () => {
    const ctx = await setup();
    const tokenRes = await api.post(`${ctx.admin}/sse-token`).set(bearer(ctx.owner.accessToken));
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.expiresIn).toBe(300);

    const stream = await openStream(`${ctx.admin}/events?token=${encodeURIComponent(tokenRes.body.token)}`);
    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');
    expect(stream.headers['cache-control']).toBe('no-cache, no-transform');
    expect(stream.headers['x-accel-buffering']).toBe('no');
    expect(openStreamCount()).toBe(1);

    const guest = { 'X-Session-Id': randomUUID() };
    const created = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send({ tableNumber: 3, items: [{ itemId: ctx.item.id, quantity: 2 }] });
    expect(created.status).toBe(201);
    const createdEvent = await stream.next('order.created');
    expect(createdEvent.type === 'order.created' && createdEvent.order.id).toBe(created.body.id);
    expect(createdEvent.type === 'order.created' && createdEvent.order.totalCents).toBe(48000);

    await api.patch(`${ctx.admin}/orders/${created.body.id}`).set(bearer(ctx.owner.accessToken)).send({ status: 'accepted' });
    const updated = await stream.next('order.updated');
    expect(updated.type === 'order.updated' && updated.order.status).toBe('accepted');

    const call = await api.post(`/api/public/${ctx.slug}/requests`).set(guest).send({ type: 'call_waiter', tableNumber: 3 });
    const requestEvent = await stream.next('request.created');
    expect(requestEvent.type === 'request.created' && requestEvent.request.id).toBe(call.body.id);
    await api.post(`/api/public/${ctx.slug}/requests`).set(guest).send({ type: 'call_waiter', tableNumber: 3 });
    expect((await stream.next('request.updated')).type).toBe('request.updated');

    await api.post(`/api/public/${ctx.slug}/orders/${created.body.id}/cancel`).set(guest);
    // Guest cancel is illegal after accept; a fresh order cancelled by the guest does reach the stream.
    const another = await api.post(`/api/public/${ctx.slug}/orders`).set(guest).send({ tableNumber: 3, items: [{ itemId: ctx.item.id, quantity: 1 }] });
    await stream.next('order.created');
    await api.post(`/api/public/${ctx.slug}/orders/${another.body.id}/cancel`).set(guest);
    const cancelled = await stream.next('order.updated');
    expect(cancelled.type === 'order.updated' && cancelled.order.status).toBe('cancelled');

    stream.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(openStreamCount()).toBe(0);
  });

  it('rejects missing, foreign and non-member tokens', async () => {
    const ctx = await setup();
    const other = await registerUser();
    const otherAdmin = `/api/admin/restaurants/${other.restaurantId}`;
    await api.patch(otherAdmin).set(bearer(other.accessToken)).send({ modules: { ordering: true } });

    const none = await api.get(`${ctx.admin}/events`);
    expect(none.status).toBe(401);
    const bearerOnly = await api.get(`${ctx.admin}/events`).set(bearer(ctx.owner.accessToken));
    expect(bearerOnly.status).toBe(401);
    const accessAsToken = await api.get(`${ctx.admin}/events?token=${ctx.owner.accessToken}`);
    expect(accessAsToken.status).toBe(401);

    const foreign = await api.post(`${otherAdmin}/sse-token`).set(bearer(other.accessToken));
    const wrongRestaurant = await api.get(`${ctx.admin}/events?token=${encodeURIComponent(foreign.body.token)}`);
    expect(wrongRestaurant.status).toBe(403);

    const notMember = await api.post(`${ctx.admin}/sse-token`).set(bearer(other.accessToken));
    expect(notMember.status).toBe(403);

    // A membership revoked after the token was issued closes the door on connect.
    const staff = await registerUser();
    const membership = await Membership.create({ userId: staff.user.id, restaurantId: ctx.owner.restaurantId, role: 'staff' });
    const staffToken = await api.post(`${ctx.admin}/sse-token`).set(bearer(staff.accessToken));
    expect(staffToken.status).toBe(200);
    await membership.destroy();
    const revoked = await api.get(`${ctx.admin}/events?token=${encodeURIComponent(staffToken.body.token)}`);
    expect(revoked.status).toBe(404);
  });
});
