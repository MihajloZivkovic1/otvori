import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 9b — per-restaurant modules { ordering, payments, pos }. Venues that already took orders or calls keep
 * working: their `ordering` module is switched on from the existing ordering_mode.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('restaurants', 'modules', {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: { ordering: false, payments: false, pos: false },
  });
  await qi.sequelize.query(
    `UPDATE restaurants SET modules = jsonb_set(modules, '{ordering}', 'true'::jsonb) WHERE ordering_mode <> 'off'`,
  );
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeColumn('restaurants', 'modules');
};
