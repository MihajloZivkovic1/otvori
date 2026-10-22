import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 9a — menu rows show a 76 px thumbnail, so each item keeps a small WebP next to the 800×800 photo.
 * Null for photos uploaded before this migration: the menu falls back to the full image.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('menu_items', 'thumbnail_url', { type: DataTypes.TEXT, allowNull: true });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('menu_items', 'thumbnail_url');
};
