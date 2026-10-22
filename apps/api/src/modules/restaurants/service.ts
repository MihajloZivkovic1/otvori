import type { Transaction } from 'sequelize';
import {
  RESTAURANT_DEFAULTS,
  type CreateRestaurantInput,
  type RestaurantDto,
  type UpdateRestaurantInput,
  isReservedSlug,
} from '@qr-menu/shared';
import { Membership, MenuItem, Restaurant } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, badRequest, conflict, notFound } from '../../utils/errors.js';
import { processLogo } from '../../utils/images.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import { slugify } from '../../utils/slug.js';
import { deleteStoredUrl, storage } from '../../utils/storage.js';
import { generateOpaqueToken } from '../../utils/tokens.js';

const DAY_MS = 86_400_000;

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
    orderingMode: r.orderingMode,
    orderingPaused: r.orderingPaused,
    pausedMessage: r.pausedMessage,
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

async function uniqueSlug(base: string, transaction: Transaction): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 55)}-${attempt + 1}`;
    if (isReservedSlug(candidate)) continue;
    const taken = await Restaurant.count({ where: { slug: candidate }, transaction });
    if (!taken) return candidate;
  }
  return `${base.slice(0, 50)}-${generateOpaqueToken(4).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/** A new venue on a 14-day trial owned by `userId`; the slug comes from the name and is made unique (-2, -3, …). */
export async function createRestaurantWithOwner(userId: string, name: string, transaction: Transaction): Promise<Restaurant> {
  const slug = await uniqueSlug(slugify(name), transaction);
  const restaurant = await Restaurant.create(
    {
      slug,
      name,
      status: 'trial',
      plan: 'trial',
      trialEndsAt: new Date(Date.now() + RESTAURANT_DEFAULTS.trialDays * DAY_MS),
    },
    { transaction },
  );
  await Membership.create({ userId, restaurantId: restaurant.id, role: 'owner' }, { transaction });
  return restaurant;
}

/**
 * POST /admin/restaurants — another venue for the signed-in user, who becomes its owner.
 * Gated: the user must already own a venue on the Pro plan (superadmins always may).
 * The new venue starts on its own 14-day trial, exactly like a registration does.
 */
export async function createRestaurant(
  user: Pick<AuthUser, 'id' | 'isSuperadmin'>,
  input: CreateRestaurantInput,
): Promise<RestaurantDto> {
  if (!user.isSuperadmin) {
    const proVenues = await Membership.count({
      where: { userId: user.id, role: 'owner' },
      include: [{ model: Restaurant, required: true, where: { plan: 'pro' } }],
    });
    if (proVenues === 0) throw new AppError(403, 'PLAN_REQUIRED', 'Adding more venues is available on the Pro plan');
  }
  const restaurant = await sequelize.transaction((transaction) =>
    createRestaurantWithOwner(user.id, input.name, transaction),
  );
  return toRestaurantDto(restaurant);
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
