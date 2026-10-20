import type { Transaction } from 'sequelize';
import { sequelize } from '../../db/sequelize.js';
import { badRequest } from '../../utils/errors.js';

type SortableTable = 'categories' | 'menu_items' | 'tables';

/**
 * Assign sort_order = position for the given ids (scoped to the restaurant).
 * Ids that do not belong to the restaurant make the whole request fail with 400.
 */
export async function applySortOrder(
  table: SortableTable,
  restaurantId: string,
  ids: string[],
  transaction: Transaction,
): Promise<void> {
  const unique = [...new Set(ids)];
  const [rows] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM "${table}" WHERE restaurant_id = :restaurantId AND id IN (:ids)`,
    { replacements: { restaurantId, ids: unique }, transaction },
  );
  const count = (rows as Array<{ count: number }>)[0]?.count ?? 0;
  if (count !== unique.length) {
    throw badRequest('Some ids do not belong to this restaurant');
  }
  const values = unique.map((_, index) => `(:id${index}::uuid, ${index})`).join(', ');
  const replacements: Record<string, unknown> = { restaurantId };
  unique.forEach((id, index) => {
    replacements[`id${index}`] = id;
  });
  const touchUpdatedAt = table === 'tables' ? '' : ', updated_at = now()';
  await sequelize.query(
    `UPDATE "${table}" AS t SET sort_order = v.ord${touchUpdatedAt}
     FROM (VALUES ${values}) AS v(id, ord)
     WHERE t.id = v.id AND t.restaurant_id = :restaurantId`,
    { replacements, transaction },
  );
}
