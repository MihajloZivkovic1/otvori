import { literal } from 'sequelize';
import type { CategoryDto, CreateCategoryInput, UpdateCategoryInput } from '@qr-menu/shared';
import { Category, MenuItem } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { notFound } from '../../utils/errors.js';
import { definedOnly } from '../../utils/objects.js';
import { deleteStoredUrl } from '../../utils/storage.js';
import { applySortOrder } from '../shared/sort-order.js';
import { touchRestaurant } from '../shared/touch-restaurant.js';

const ITEM_COUNT = literal('(SELECT COUNT(*) FROM menu_items mi WHERE mi.category_id = "Category"."id")');

function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    restaurantId: category.restaurantId,
    name: category.name,
    sortOrder: category.sortOrder,
    isHidden: category.isHidden,
    itemCount: Number(category.get('itemCount') ?? 0),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

async function loadCategory(restaurantId: string, categoryId: string): Promise<Category> {
  const category = await Category.findOne({
    where: { id: categoryId, restaurantId },
    attributes: { include: [[ITEM_COUNT, 'itemCount']] },
  });
  if (!category) throw notFound('Category not found');
  return category;
}

export async function listCategories(restaurantId: string): Promise<CategoryDto[]> {
  const categories = await Category.findAll({
    where: { restaurantId },
    attributes: { include: [[ITEM_COUNT, 'itemCount']] },
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  return categories.map(toCategoryDto);
}

export async function getCategory(restaurantId: string, categoryId: string): Promise<CategoryDto> {
  return toCategoryDto(await loadCategory(restaurantId, categoryId));
}

export async function createCategory(restaurantId: string, input: CreateCategoryInput): Promise<CategoryDto> {
  const id = await sequelize.transaction(async (transaction) => {
    const sortOrder = input.sortOrder ?? ((await Category.max<number, Category>('sortOrder', { where: { restaurantId }, transaction })) ?? -1) + 1;
    const category = await Category.create(
      { restaurantId, name: input.name, isHidden: input.isHidden ?? false, sortOrder },
      { transaction },
    );
    await touchRestaurant(restaurantId, transaction);
    return category.id;
  });
  return getCategory(restaurantId, id);
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  const category = await loadCategory(restaurantId, categoryId);
  await sequelize.transaction(async (transaction) => {
    await category.update(definedOnly(input), { transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  return getCategory(restaurantId, categoryId);
}

/** Deletes the category and (via FK cascade) its items. Owner only. */
export async function deleteCategory(restaurantId: string, categoryId: string): Promise<void> {
  const category = await loadCategory(restaurantId, categoryId);
  const items = await MenuItem.findAll({ where: { restaurantId, categoryId }, attributes: ['imageUrl'] });
  await sequelize.transaction(async (transaction) => {
    await category.destroy({ transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  await Promise.all(items.map((item) => deleteStoredUrl(item.imageUrl)));
}

export async function reorderCategories(restaurantId: string, ids: string[]): Promise<CategoryDto[]> {
  await sequelize.transaction(async (transaction) => {
    await applySortOrder('categories', restaurantId, ids, transaction);
    await touchRestaurant(restaurantId, transaction);
  });
  return listCategories(restaurantId);
}
