import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/** Promotions: optional look overrides `{ textColor, backgroundColor, pillPosition }` (shared `promotionStyleSchema`). */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('promotions', 'style', { type: DataTypes.JSONB, allowNull: true });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('promotions', 'style');
};
