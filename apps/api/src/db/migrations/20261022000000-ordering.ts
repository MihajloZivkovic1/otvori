import { DataTypes, Sequelize, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

const uuidPk = () => ({
  type: DataTypes.UUID,
  allowNull: false,
  primaryKey: true,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

const fk = (table: string, onDelete: 'CASCADE' | 'SET NULL', allowNull = false) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: table, key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});

const timestamp = () => ({
  type: DataTypes.DATE,
  allowNull: false,
  defaultValue: Sequelize.literal('now()'),
});

/**
 * Phase 6 — table ordering: orders + order_items (snapshots of what was ordered), service_requests
 * ("call the waiter" / "the bill"), the per-restaurant ordering switches and the per-table block.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('restaurants', 'ordering_mode', {
    type: DataTypes.ENUM('off', 'call_waiter', 'order'),
    allowNull: false,
    defaultValue: 'off',
  });
  await qi.addColumn('restaurants', 'ordering_paused', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  await qi.addColumn('restaurants', 'paused_message', { type: DataTypes.TEXT, allowNull: true });

  await qi.addColumn('tables', 'blocked_until', { type: DataTypes.DATE, allowNull: true });

  await qi.createTable('orders', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    // Deleting a table keeps its past orders; table_number is the snapshot shown to staff and guests.
    table_id: fk('tables', 'SET NULL', true),
    table_number: { type: DataTypes.INTEGER, allowNull: false },
    session_id: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('new', 'accepted', 'delivered', 'rejected', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'new',
    },
    // Daily sequential per restaurant ("#142"); assigned under a row lock on the restaurant.
    number: { type: DataTypes.INTEGER, allowNull: false },
    guest_name: { type: DataTypes.TEXT, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    total_cents: { type: DataTypes.INTEGER, allowNull: false },
    locale: { type: DataTypes.TEXT, allowNull: false },
    rejected_reason: { type: DataTypes.TEXT, allowNull: true },
    created_at: timestamp(),
    updated_at: timestamp(),
    accepted_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
  });
  await qi.addIndex('orders', ['restaurant_id', 'status', 'created_at'], { name: 'orders_restaurant_id_status_created_at_idx' });
  await qi.addIndex('orders', ['restaurant_id', 'session_id'], { name: 'orders_restaurant_id_session_id_idx' });
  await qi.addIndex('orders', ['table_id'], { name: 'orders_table_id_idx' });
  // The expiry job scans every restaurant for stale `new` orders.
  await qi.sequelize.query(`CREATE INDEX orders_new_created_at_idx ON orders (created_at) WHERE status = 'new'`);

  await qi.createTable('order_items', {
    id: uuidPk(),
    order_id: fk('orders', 'CASCADE'),
    menu_item_id: fk('menu_items', 'SET NULL', true),
    variant_id: fk('item_variants', 'SET NULL', true),
    // Snapshots: the guest's locale + the restaurant default locale, variant name and unit price at order time.
    name: { type: DataTypes.JSONB, allowNull: false },
    variant_name: { type: DataTypes.TEXT, allowNull: true },
    unit_price_cents: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    line_note: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  });
  await qi.addIndex('order_items', ['order_id'], { name: 'order_items_order_id_idx' });

  await qi.createTable('service_requests', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    table_id: fk('tables', 'CASCADE'),
    table_number: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('call_waiter', 'bill'), allowNull: false },
    status: { type: DataTypes.ENUM('open', 'done'), allowNull: false, defaultValue: 'open' },
    created_at: timestamp(),
    updated_at: timestamp(),
    done_at: { type: DataTypes.DATE, allowNull: true },
  });
  await qi.addIndex('service_requests', ['restaurant_id', 'status', 'created_at'], {
    name: 'service_requests_restaurant_id_status_created_at_idx',
  });
  await qi.addIndex('service_requests', ['table_id'], { name: 'service_requests_table_id_idx' });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.dropTable('service_requests');
  await qi.dropTable('order_items');
  await qi.dropTable('orders');
  await qi.removeColumn('tables', 'blocked_until');
  await qi.removeColumn('restaurants', 'paused_message');
  await qi.removeColumn('restaurants', 'ordering_paused');
  await qi.removeColumn('restaurants', 'ordering_mode');
  for (const enumType of [
    'enum_service_requests_status',
    'enum_service_requests_type',
    'enum_orders_status',
    'enum_restaurants_ordering_mode',
  ]) {
    await qi.sequelize.query(`DROP TYPE IF EXISTS "${enumType}"`);
  }
};
