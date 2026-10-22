import { DataTypes, Sequelize, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 9d — POS integration (Octopos): product codes on menu items, the per-restaurant POS configuration and a
 * persistent job queue for the calls to the register (open the order on a table, close it with a fiscal receipt).
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('menu_items', 'pos_product_code', { type: DataTypes.TEXT, allowNull: true });
  await qi.addIndex('menu_items', ['restaurant_id', 'pos_product_code'], { name: 'menu_items_restaurant_id_pos_product_code_idx' });
  await qi.addColumn('restaurants', 'pos_config', { type: DataTypes.JSONB, allowNull: true });

  await qi.createTable('pos_jobs', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
    restaurant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'restaurants', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'orders', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    type: { type: DataTypes.ENUM('send_order', 'close_order'), allowNull: false },
    status: { type: DataTypes.ENUM('queued', 'running', 'done', 'failed'), allowNull: false, defaultValue: 'queued' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    next_run_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    last_error: { type: DataTypes.TEXT, allowNull: true },
    // What the job needs beyond the order (e.g. the amount to close with).
    payload: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
  });
  await qi.addIndex('pos_jobs', ['order_id'], { name: 'pos_jobs_order_id_idx' });
  await qi.sequelize.query(`CREATE INDEX pos_jobs_queued_next_run_at_idx ON pos_jobs (next_run_at) WHERE status = 'queued'`);
};

export const down: Migration = async ({ context: qi }) => {
  await qi.dropTable('pos_jobs');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_pos_jobs_type"');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_pos_jobs_status"');
  await qi.removeColumn('restaurants', 'pos_config');
  await qi.removeIndex('menu_items', 'menu_items_restaurant_id_pos_product_code_idx');
  await qi.removeColumn('menu_items', 'pos_product_code');
};
