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

export const up: Migration = async ({ context: qi }) => {
  await qi.sequelize.query('CREATE EXTENSION IF NOT EXISTS citext');

  await qi.createTable('restaurants', {
    id: uuidPk(),
    slug: { type: DataTypes.TEXT, allowNull: false, unique: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    tagline: { type: DataTypes.TEXT, allowNull: true },
    menu_note: { type: DataTypes.TEXT, allowNull: true },
    logo_url: { type: DataTypes.TEXT, allowNull: true },
    primary_color: { type: DataTypes.TEXT, allowNull: false, defaultValue: '#7A3E48' },
    theme: { type: DataTypes.ENUM('light', 'dark', 'auto'), allowNull: false, defaultValue: 'light' },
    currency: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'RSD' },
    default_locale: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'sr' },
    supported_locales: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: Sequelize.literal("'{sr,en}'::text[]"),
    },
    timezone: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Europe/Belgrade' },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('active', 'trial', 'suspended'), allowNull: false, defaultValue: 'trial' },
    plan: { type: DataTypes.ENUM('trial', 'starter', 'pro'), allowNull: false, defaultValue: 'trial' },
    trial_ends_at: { type: DataTypes.DATE, allowNull: true },
    published_at: { type: DataTypes.DATE, allowNull: true },
    created_at: timestamp(),
    updated_at: timestamp(),
  });

  await qi.createTable('users', {
    id: uuidPk(),
    email: { type: DataTypes.CITEXT, allowNull: false, unique: true },
    password_hash: { type: DataTypes.TEXT, allowNull: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    is_superadmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: timestamp(),
    updated_at: timestamp(),
  });

  await qi.createTable('memberships', {
    id: uuidPk(),
    user_id: fk('users', 'CASCADE'),
    restaurant_id: fk('restaurants', 'CASCADE'),
    role: { type: DataTypes.ENUM('owner', 'staff'), allowNull: false },
  });
  await qi.addIndex('memberships', ['user_id', 'restaurant_id'], {
    unique: true,
    name: 'memberships_user_id_restaurant_id_unique',
  });
  await qi.addIndex('memberships', ['restaurant_id'], { name: 'memberships_restaurant_id_idx' });

  await qi.createTable('auth_tokens', {
    id: uuidPk(),
    user_id: fk('users', 'CASCADE'),
    token_hash: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM('magic_link', 'password_reset', 'refresh'), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: timestamp(),
  });
  await qi.addIndex('auth_tokens', ['user_id'], { name: 'auth_tokens_user_id_idx' });
  await qi.addIndex('auth_tokens', ['token_hash', 'type'], { name: 'auth_tokens_token_hash_type_idx' });

  await qi.createTable('categories', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    name: { type: DataTypes.JSONB, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: timestamp(),
    updated_at: timestamp(),
  });
  await qi.addIndex('categories', ['restaurant_id', 'sort_order'], { name: 'categories_restaurant_id_sort_order_idx' });

  await qi.createTable('menu_items', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    category_id: fk('categories', 'CASCADE'),
    name: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.JSONB, allowNull: true },
    price_cents: { type: DataTypes.INTEGER, allowNull: false },
    image_url: { type: DataTypes.TEXT, allowNull: true },
    allergens: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: Sequelize.literal("'{}'::text[]") },
    tags: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: Sequelize.literal("'{}'::text[]") },
    is_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    unavailable_until: { type: DataTypes.DATE, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: timestamp(),
    updated_at: timestamp(),
  });
  await qi.addIndex('menu_items', ['restaurant_id', 'sort_order'], { name: 'menu_items_restaurant_id_sort_order_idx' });
  await qi.addIndex('menu_items', ['category_id'], { name: 'menu_items_category_id_idx' });

  await qi.createTable('item_variants', {
    id: uuidPk(),
    menu_item_id: fk('menu_items', 'CASCADE'),
    name: { type: DataTypes.TEXT, allowNull: false },
    price_cents: { type: DataTypes.INTEGER, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  });
  await qi.addIndex('item_variants', ['menu_item_id'], { name: 'item_variants_menu_item_id_idx' });

  await qi.createTable('tables', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    number: { type: DataTypes.INTEGER, allowNull: false },
    label: { type: DataTypes.TEXT, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: timestamp(),
  });
  await qi.addIndex('tables', ['restaurant_id', 'number'], { unique: true, name: 'tables_restaurant_id_number_unique' });
  await qi.addIndex('tables', ['restaurant_id', 'sort_order'], { name: 'tables_restaurant_id_sort_order_idx' });

  await qi.createTable('scan_events', {
    id: uuidPk(),
    restaurant_id: fk('restaurants', 'CASCADE'),
    table_id: fk('tables', 'SET NULL', true),
    session_id: { type: DataTypes.UUID, allowNull: false },
    scanned_at: timestamp(),
  });
  await qi.addIndex('scan_events', ['restaurant_id', 'scanned_at'], { name: 'scan_events_restaurant_id_scanned_at_idx' });
  await qi.addIndex('scan_events', ['table_id'], { name: 'scan_events_table_id_idx' });
  await qi.addIndex('scan_events', ['restaurant_id', 'session_id'], { name: 'scan_events_restaurant_id_session_id_idx' });

  await qi.createTable('item_views', {
    id: uuidPk(),
    scan_event_id: fk('scan_events', 'CASCADE'),
    menu_item_id: fk('menu_items', 'CASCADE'),
    viewed_at: timestamp(),
  });
  await qi.addIndex('item_views', ['scan_event_id'], { name: 'item_views_scan_event_id_idx' });
  await qi.addIndex('item_views', ['menu_item_id', 'viewed_at'], { name: 'item_views_menu_item_id_viewed_at_idx' });
};

export const down: Migration = async ({ context: qi }) => {
  for (const table of [
    'item_views',
    'scan_events',
    'tables',
    'item_variants',
    'menu_items',
    'categories',
    'auth_tokens',
    'memberships',
    'users',
    'restaurants',
  ]) {
    await qi.dropTable(table);
  }
  for (const enumType of [
    'enum_auth_tokens_type',
    'enum_memberships_role',
    'enum_restaurants_plan',
    'enum_restaurants_status',
    'enum_restaurants_theme',
  ]) {
    await qi.sequelize.query(`DROP TYPE IF EXISTS "${enumType}"`);
  }
};
