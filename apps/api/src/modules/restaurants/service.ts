import type { RestaurantDto, UpdateRestaurantInput } from '@qr-menu/shared';
import { MenuItem, Restaurant } from '../../db/models/index.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { processLogo } from '../../utils/images.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import { deleteStoredUrl, storage } from '../../utils/storage.js';

export function toRestaurantDto(r: Restaurant): RestaurantDto {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    menuNote: r.menuNote,
    logoUrl: r.logoUrl,
    primaryColor: r.primaryColor,
    theme: r.theme,
    currency: r.currency,
    defaultLocale: r.defaultLocale,
    supportedLocales: r.supportedLocales,
    timezone: r.timezone,
    address: r.address,
    city: r.city,
    status: r.status,
    plan: r.plan,
    trialEndsAt: toIso(r.trialEndsAt),
    publishedAt: toIso(r.publishedAt),
    publicUrl: buildMenuUrl(r.slug),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId);
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

export async function getRestaurant(restaurantId: string): Promise<RestaurantDto> {
  return toRestaurantDto(await loadRestaurant(restaurantId));
}

export async function updateRestaurant(restaurantId: string, input: UpdateRestaurantInput): Promise<RestaurantDto> {
  const restaurant = await loadRestaurant(restaurantId);
  if (input.slug && input.slug !== restaurant.slug) {
    const taken = await Restaurant.count({ where: { slug: input.slug } });
    if (taken) throw conflict('SLUG_TAKEN', 'This slug is already in use');
  }
  const supportedLocales: string[] = input.supportedLocales ?? restaurant.supportedLocales;
  const defaultLocale: string = input.defaultLocale ?? restaurant.defaultLocale;
  if (!supportedLocales.includes(defaultLocale)) {
    throw badRequest('supportedLocales must include defaultLocale');
  }
  await restaurant.update(definedOnly(input));
  return toRestaurantDto(restaurant);
}

export async function uploadLogo(restaurantId: string, file: Buffer): Promise<RestaurantDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const png = await processLogo(file);
  const key = `restaurants/${restaurant.id}/logo-${Date.now()}.png`;
  const url = await storage.put(key, png, 'image/png');
  const previous = restaurant.logoUrl;
  await restaurant.update({ logoUrl: url });
  await deleteStoredUrl(previous);
  return toRestaurantDto(restaurant);
}

export async function publishRestaurant(restaurantId: string): Promise<RestaurantDto> {
  const restaurant = await loadRestaurant(restaurantId);
  await restaurant.update({ publishedAt: new Date() });
  return toRestaurantDto(restaurant);
}

export async function deleteRestaurant(restaurantId: string): Promise<void> {
  const restaurant = await loadRestaurant(restaurantId);
  const items = await MenuItem.findAll({ where: { restaurantId }, attributes: ['imageUrl'] });
  await restaurant.destroy(); // FKs cascade to categories, items, variants, tables, memberships, scans
  await deleteStoredUrl(restaurant.logoUrl);
  await Promise.all(items.map((item) => deleteStoredUrl(item.imageUrl)));
}
