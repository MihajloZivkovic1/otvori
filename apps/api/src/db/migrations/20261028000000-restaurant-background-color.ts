import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/** Branding: page background of the light appearance (default = the cream of the design; e.g. pure white). */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('restaurants', 'background_color', {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '#F7F2EB',
  });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('restaurants', 'background_color');
};
