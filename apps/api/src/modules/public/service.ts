import { Op } from 'sequelize';
import {
  isEffectivelyAvailable,
  pickLocale,
  resolveText,
  type PublicEventInput,
  type PublicMenuDto,
  type PublicMenuItemDto,
} from '@qr-menu/shared';
import { Category, ItemVariant, ItemView, MenuItem, Restaurant, RestaurantTable, ScanEvent } from '../../db/models/index.js';
import { notFound } from '../../utils/errors.js';

/** A second "scan" from the same session within this window is treated as a page refresh. */
const SCAN_DEDUP_WINDOW_MS = 30 * 60_000;
/** Item views attach to the session's latest scan within this window. */
const SESSION_LOOKBACK_MS = 24 * 60 * 60_000;

export async function loadPublishedRestaurant(slug: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findOne({ where: { slug } });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  if (!restaurant.publishedAt || restaurant.status === 'suspended') {
    throw notFound('This menu is not published', 'MENU_NOT_PUBLISHED');
  }
  return restaurant;
}

export async function getPublicMenu(slug: string, requestedLocale?: string): Promise<PublicMenuDto> {
  const restaurant = await loadPublishedRestaurant(slug);
  const locale = pickLocale(requestedLocale, restaurant.supportedLocales, restaurant.defaultLocale);
  const fallback = restaurant.defaultLocale;
  const variants = { model: ItemVariant, as: 'variants' } as const;

  const [categories, items] = await Promise.all([
    Category.findAll({
      where: { restaurantId: restaurant.id, isHidden: false },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    }),
    MenuItem.findAll({
      where: { restaurantId: restaurant.id },
      include: [variants],
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
        [variants, 'sortOrder', 'ASC'],
      ],
    }),
  ]);

  const now = new Date();
  const itemsByCategory = new Map<string, PublicMenuItemDto[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push({
      id: item.id,
      name: resolveText(item.name, locale, fallback),
      description: item.description ? resolveText(item.description, locale, fallback) || null : null,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      allergens: item.allergens,
      tags: item.tags,
      isAvailable: isEffectivelyAvailable(item.isAvailable, item.unavailableUntil, now),
      variants: (item.variants ?? []).map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents })),
    });
    itemsByCategory.set(item.categoryId, list);
  }

  return {
    restaurant: {
      slug: restaurant.slug,
      name: restaurant.name,
      tagline: restaurant.tagline,
      menuNote: restaurant.menuNote,
      logoUrl: restaurant.logoUrl,
      primaryColor: restaurant.primaryColor,
      theme: restaurant.theme,
      currency: restaurant.currency,
      defaultLocale: restaurant.defaultLocale,
      supportedLocales: restaurant.supportedLocales,
      address: restaurant.address,
      city: restaurant.city,
    },
    locale,
    categories: categories
      .map((category) => ({
        id: category.id,
        name: resolveText(category.name, locale, fallback),
        items: itemsByCategory.get(category.id) ?? [],
      }))
      .filter((category) => category.items.length > 0),
    updatedAt: restaurant.updatedAt.toISOString(),
  };
}

async function latestScan(restaurantId: string, sessionId: string, windowMs: number): Promise<ScanEvent | null> {
  return ScanEvent.findOne({
    where: { restaurantId, sessionId, scannedAt: { [Op.gte]: new Date(Date.now() - windowMs) } },
    order: [['scannedAt', 'DESC']],
  });
}

export async function recordEvent(slug: string, input: PublicEventInput): Promise<void> {
  const restaurant = await loadPublishedRestaurant(slug);

  if (input.type === 'scan') {
    const table = input.tableNumber
      ? await RestaurantTable.findOne({ where: { restaurantId: restaurant.id, number: input.tableNumber }, attributes: ['id'] })
      : null;
    const recent = await latestScan(restaurant.id, input.sessionId, SCAN_DEDUP_WINDOW_MS);
    if (recent) {
      if (!recent.tableId && table) await recent.update({ tableId: table.id });
      return;
    }
    await ScanEvent.create({ restaurantId: restaurant.id, tableId: table?.id ?? null, sessionId: input.sessionId });
    return;
  }

  const item = await MenuItem.findOne({ where: { id: input.itemId, restaurantId: restaurant.id }, attributes: ['id'] });
  if (!item) throw notFound('Menu item not found');
  const scan =
    (await latestScan(restaurant.id, input.sessionId, SESSION_LOOKBACK_MS)) ??
    (await ScanEvent.create({ restaurantId: restaurant.id, tableId: null, sessionId: input.sessionId }));
  await ItemView.create({ scanEventId: scan.id, menuItemId: item.id });
}
