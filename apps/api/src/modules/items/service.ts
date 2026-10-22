import type { Order, Transaction } from 'sequelize';
import {
  isEffectivelyAvailable,
  type AvailabilityInput,
  type CreateItemInput,
  type ItemVariantInput,
  type ListItemsQuery,
  type MenuItemDto,
  type UpdateItemInput,
} from '@qr-menu/shared';
import { Category, ItemVariant, MenuItem, Restaurant } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { notFound } from '../../utils/errors.js';
import { processItemImage, processItemThumbnail } from '../../utils/images.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { deleteStoredUrl, storage } from '../../utils/storage.js';
import { nextOccurrenceOfTime } from '../../utils/time.js';
import { applySortOrder } from '../shared/sort-order.js';
import { touchRestaurant } from '../shared/touch-restaurant.js';

const VARIANTS_INCLUDE = { model: ItemVariant, as: 'variants' };
const ITEM_ORDER: Order = [
  ['sortOrder', 'ASC'],
  ['createdAt', 'ASC'],
  [VARIANTS_INCLUDE, 'sortOrder', 'ASC'],
];

export function toItemDto(item: MenuItem, now = new Date()): MenuItemDto {
  const variants = [...(item.variants ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    allergens: item.allergens,
    tags: item.tags,
    isAvailable: item.isAvailable,
    unavailableUntil: toIso(item.unavailableUntil),
    isEffectivelyAvailable: isEffectivelyAvailable(item.isAvailable, item.unavailableUntil, now),
    sortOrder: item.sortOrder,
    variants: variants.map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents, sortOrder: v.sortOrder })),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function loadItem(restaurantId: string, itemId: string, transaction?: Transaction): Promise<MenuItem> {
  const item = await MenuItem.findOne({
    where: { id: itemId, restaurantId },
    include: [VARIANTS_INCLUDE],
    order: [[VARIANTS_INCLUDE, 'sortOrder', 'ASC']],
    transaction,
  });
  if (!item) throw notFound('Menu item not found');
  return item;
}

async function assertCategory(restaurantId: string, categoryId: string, transaction?: Transaction): Promise<void> {
  const count = await Category.count({ where: { id: categoryId, restaurantId }, transaction });
  if (!count) throw notFound('Category not found');
}

async function replaceVariants(itemId: string, variants: ItemVariantInput[], transaction: Transaction): Promise<void> {
  await ItemVariant.destroy({ where: { menuItemId: itemId }, transaction });
  if (variants.length === 0) return;
  await ItemVariant.bulkCreate(
    variants.map((v, index) => ({
      menuItemId: itemId,
      name: v.name,
      priceCents: v.priceCents,
      sortOrder: v.sortOrder ?? index,
    })),
    { transaction },
  );
}

function normalizeDescription(description: UpdateItemInput['description']): Record<string, string> | null | undefined {
  if (description === undefined) return undefined;
  if (description === null) return null;
  const entries = Object.entries(description).filter(([, v]) => typeof v === 'string' && v.length > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

export async function listItems(restaurantId: string, query: ListItemsQuery): Promise<MenuItemDto[]> {
  const items = await MenuItem.findAll({
    where: { restaurantId, ...(query.categoryId ? { categoryId: query.categoryId } : {}) },
    include: [VARIANTS_INCLUDE],
    order: ITEM_ORDER,
  });
  const now = new Date();
  return items.map((item) => toItemDto(item, now));
}

export async function getItem(restaurantId: string, itemId: string): Promise<MenuItemDto> {
  return toItemDto(await loadItem(restaurantId, itemId));
}

export async function createItem(restaurantId: string, input: CreateItemInput): Promise<MenuItemDto> {
  const id = await sequelize.transaction(async (transaction) => {
    await assertCategory(restaurantId, input.categoryId, transaction);
    const sortOrder =
      input.sortOrder ??
      ((await MenuItem.max<number, MenuItem>('sortOrder', {
        where: { restaurantId, categoryId: input.categoryId },
        transaction,
      })) ?? -1) + 1;
    const item = await MenuItem.create(
      {
        restaurantId,
        categoryId: input.categoryId,
        name: input.name,
        description: normalizeDescription(input.description) ?? null,
        priceCents: input.priceCents,
        allergens: input.allergens ?? [],
        tags: input.tags ?? [],
        isAvailable: input.isAvailable ?? true,
        unavailableUntil: input.unavailableUntil ? new Date(input.unavailableUntil) : null,
        sortOrder,
      },
      { transaction },
    );
    await replaceVariants(item.id, input.variants ?? [], transaction);
    await touchRestaurant(restaurantId, transaction);
    return item.id;
  });
  return getItem(restaurantId, id);
}

export async function updateItem(restaurantId: string, itemId: string, input: UpdateItemInput): Promise<MenuItemDto> {
  await sequelize.transaction(async (transaction) => {
    const item = await loadItem(restaurantId, itemId, transaction);
    if (input.categoryId && input.categoryId !== item.categoryId) {
      await assertCategory(restaurantId, input.categoryId, transaction);
    }
    const { variants, description, unavailableUntil, ...rest } = input;
    await item.update(
      {
        ...definedOnly(rest),
        ...(description !== undefined ? { description: normalizeDescription(description) ?? null } : {}),
        ...(unavailableUntil !== undefined
          ? { unavailableUntil: unavailableUntil ? new Date(unavailableUntil) : null }
          : {}),
      },
      { transaction },
    );
    if (variants !== undefined) await replaceVariants(item.id, variants, transaction);
    await touchRestaurant(restaurantId, transaction);
  });
  return getItem(restaurantId, itemId);
}

export async function deleteItem(restaurantId: string, itemId: string): Promise<void> {
  const item = await loadItem(restaurantId, itemId);
  await sequelize.transaction(async (transaction) => {
    await item.destroy({ transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  await deleteStoredUrl(item.imageUrl);
  await deleteStoredUrl(item.thumbnailUrl);
}

export async function reorderItems(restaurantId: string, ids: string[]): Promise<MenuItemDto[]> {
  await sequelize.transaction(async (transaction) => {
    await applySortOrder('menu_items', restaurantId, ids, transaction);
    await touchRestaurant(restaurantId, transaction);
  });
  return listItems(restaurantId, {});
}

/** Resolve the `until` value of an availability change to an instant. */
export function resolveUntil(until: NonNullable<AvailabilityInput['until']>, timezone: string, now = new Date()): Date {
  if (until === 'tomorrow-06:00') return nextOccurrenceOfTime(6, 0, timezone, now);
  return new Date(until);
}

export async function setAvailability(
  restaurantId: string,
  itemId: string,
  input: AvailabilityInput,
): Promise<MenuItemDto> {
  await sequelize.transaction(async (transaction) => {
    const item = await loadItem(restaurantId, itemId, transaction);
    let patch: { isAvailable: boolean; unavailableUntil: Date | null };
    if (input.available) {
      patch = { isAvailable: true, unavailableUntil: null };
    } else if (input.until) {
      const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['timezone'], transaction });
      const timezone = restaurant?.timezone ?? 'Europe/Belgrade';
      patch = { isAvailable: true, unavailableUntil: resolveUntil(input.until, timezone) };
    } else {
      patch = { isAvailable: false, unavailableUntil: null };
    }
    await item.update(patch, { transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  return getItem(restaurantId, itemId);
}

export async function uploadItemImage(restaurantId: string, itemId: string, file: Buffer): Promise<MenuItemDto> {
  const item = await loadItem(restaurantId, itemId);
  const [webp, thumb] = await Promise.all([processItemImage(file), processItemThumbnail(file)]);
  const stamp = Date.now();
  const key = `restaurants/${restaurantId}/items/${item.id}-${stamp}.webp`;
  const thumbKey = `restaurants/${restaurantId}/items/${item.id}-${stamp}-thumb.webp`;
  const [url, thumbnailUrl] = await Promise.all([storage.put(key, webp, 'image/webp'), storage.put(thumbKey, thumb, 'image/webp')]);
  const previous = { imageUrl: item.imageUrl, thumbnailUrl: item.thumbnailUrl };
  await sequelize.transaction(async (transaction) => {
    await item.update({ imageUrl: url, thumbnailUrl }, { transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  await deleteStoredUrl(previous.imageUrl);
  await deleteStoredUrl(previous.thumbnailUrl);
  return getItem(restaurantId, itemId);
}
