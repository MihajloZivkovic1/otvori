import supertest from 'supertest';
import type {
  AuthResponseDto,
  CategoryDto,
  CreateCategoryInput,
  CreateItemInput,
  MenuItemDto,
  RestaurantDto,
} from '@qr-menu/shared';
import { createApp } from '../src/app.js';
import { sequelize } from '../src/db/sequelize.js';
import { Membership } from '../src/db/models/index.js';
import { settleBackgroundWork } from '../src/modules/payments/service.js';
import { resetPinLockouts } from '../src/modules/security/lockout.js';
import { outbox } from '../src/utils/mailer.js';

export const app = createApp();
export const api = supertest(app);

export async function resetDatabase(): Promise<void> {
  // Webhook results are applied after the response; a TRUNCATE racing one of them deadlocks.
  await settleBackgroundWork();
  await sequelize.query(
    'TRUNCATE TABLE audit_log, team_invites, pos_jobs, payments, order_items, orders, service_requests, item_views, scan_events, tables, item_variants, menu_items, categories, auth_tokens, memberships, users, restaurants CASCADE',
  );
  outbox.length = 0;
  resetPinLockouts();
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export function setCookies(res: supertest.Response): string[] {
  const header = (res.headers as Record<string, string | string[] | undefined>)['set-cookie'];
  return Array.isArray(header) ? header : header ? [header] : [];
}

export function refreshCookie(res: supertest.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('tabla_refresh='));
  if (!cookie) throw new Error('No refresh cookie in response');
  return cookie.split(';')[0]!;
}

let counter = 0;

export interface RegisteredUser extends AuthResponseDto {
  restaurantId: string;
  cookie: string;
  email: string;
  password: string;
}

export async function registerUser(
  overrides: Partial<{ name: string; email: string; password: string; restaurantName: string }> = {},
): Promise<RegisteredUser> {
  counter += 1;
  const body = {
    name: `User ${counter}`,
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'password123',
    restaurantName: `Restaurant ${counter}`,
    ...overrides,
  };
  const res = await api.post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = res.body as AuthResponseDto;
  return {
    ...auth,
    restaurantId: auth.memberships[0]!.restaurant.id,
    cookie: refreshCookie(res),
    email: body.email,
    password: body.password,
  };
}

export async function createCategory(
  user: RegisteredUser,
  body: CreateCategoryInput,
  restaurantId = user.restaurantId,
): Promise<CategoryDto> {
  const res = await api.post(`/api/admin/restaurants/${restaurantId}/categories`).set(bearer(user.accessToken)).send(body);
  if (res.status !== 201) throw new Error(`createCategory failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as CategoryDto;
}

export async function createItem(
  user: RegisteredUser,
  body: CreateItemInput,
  restaurantId = user.restaurantId,
): Promise<MenuItemDto> {
  const res = await api.post(`/api/admin/restaurants/${restaurantId}/items`).set(bearer(user.accessToken)).send(body);
  if (res.status !== 201) throw new Error(`createItem failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as MenuItemDto;
}

export async function publish(user: RegisteredUser, restaurantId = user.restaurantId): Promise<RestaurantDto> {
  const res = await api.post(`/api/admin/restaurants/${restaurantId}/publish`).set(bearer(user.accessToken));
  if (res.status !== 200) throw new Error(`publish failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as RestaurantDto;
}

/** Signs in with the password (a fresh session, with login audit rows and — for owners with a PIN — elevations). */
export async function login(email: string, password: string): Promise<RegisteredUser> {
  const res = await api.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = res.body as AuthResponseDto;
  return { ...auth, restaurantId: auth.memberships[0]!.restaurant.id, cookie: refreshCookie(res), email, password };
}

/** A second registered user added to `owner`'s venue as staff; `restaurantId` points at the owner's venue. */
export async function addStaff(owner: RegisteredUser): Promise<RegisteredUser> {
  const staff = await registerUser();
  await Membership.create({ userId: staff.user.id, restaurantId: owner.restaurantId, role: 'staff' });
  return { ...staff, restaurantId: owner.restaurantId };
}

export const DEMO_PIN = '2580';

/** Sets the owner PIN and unlocks: returns the headers (bearer + X-Elevation) for owner requests. */
export async function setPinAndUnlock(owner: RegisteredUser, pin = DEMO_PIN, window = '5'): Promise<Record<string, string>> {
  const set = await api
    .put(`/api/admin/restaurants/${owner.restaurantId}/security/pin`)
    .set(bearer(owner.accessToken))
    .send({ pin, password: owner.password });
  if (set.status !== 200) throw new Error(`set pin failed: ${set.status} ${JSON.stringify(set.body)}`);
  const unlock = await api
    .post(`/api/admin/restaurants/${owner.restaurantId}/security/unlock`)
    .set(bearer(owner.accessToken))
    .send({ pin, window });
  if (unlock.status !== 200) throw new Error(`unlock failed: ${unlock.status} ${JSON.stringify(unlock.body)}`);
  return { ...bearer(owner.accessToken), 'X-Elevation': (unlock.body as { token: string }).token };
}
