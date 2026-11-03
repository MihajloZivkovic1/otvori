import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/** Promotions: optional outbound link (`link_url`) with the label of its button (`link_label`). */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('promotions', 'link_url', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('promotions', 'link_label', { type: DataTypes.TEXT, allowNull: true });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('promotions', 'link_label');
  await qi.removeColumn('promotions', 'link_url');
};
