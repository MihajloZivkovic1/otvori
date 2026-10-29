import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/** Menu items: the translated heading of the variant group ("Vrsta kafe", "Ukus"); null = the default "Size". */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('menu_items', 'variant_label', { type: DataTypes.JSONB, allowNull: true });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('menu_items', 'variant_label');
};
