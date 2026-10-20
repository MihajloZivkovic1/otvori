import type { Transaction } from 'sequelize';
import { sequelize } from '../../db/sequelize.js';

/**
 * Bump restaurants.updated_at. Called by every service that changes a category, item,
 * variant or table so the public menu's `updatedAt` (and cache keys) move with the content.
 */
export async function touchRestaurant(restaurantId: string, transaction?: Transaction): Promise<void> {
  await sequelize.query('UPDATE restaurants SET updated_at = now() WHERE id = :id', {
    replacements: { id: restaurantId },
    transaction,
  });
}
