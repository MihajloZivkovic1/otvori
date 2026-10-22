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
import { outbox } from '../src/utils/mailer.js';

export const app = createApp();
export const api = supertest(app);

export async function resetDatabase(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE order_items, orders, service_requests, item_views, scan_events, tables, item_variants, menu_items, categories, auth_tokens, memberships, users, restaurants CASCADE',
  );
  outbox.length = 0;
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
