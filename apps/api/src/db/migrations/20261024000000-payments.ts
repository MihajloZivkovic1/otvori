import { DataTypes, Sequelize, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 9c — online payment: the order's payment state (+ the fiscal fields Phase 9d fills in), one row per payment
 * attempt at the provider, and the per-restaurant provider configuration (merchant secret encrypted at rest).
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('restaurants', 'payment_config', { type: DataTypes.JSONB, allowNull: true });

  await qi.addColumn('orders', 'payment_status', {
    type: DataTypes.ENUM('unpaid', 'pending', 'paid', 'failed', 'cash'),
    allowNull: false,
    defaultValue: 'unpaid',
  });
  await qi.addColumn('orders', 'tip_cents', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await qi.addColumn('orders', 'paid_amount_cents', { type: DataTypes.INTEGER, allowNull: true });
  await qi.addColumn('orders', 'paid_at', { type: DataTypes.DATE, allowNull: true });
  // Reference of the latest payment attempt at the provider (payments.provider_ref).
  await qi.addColumn('orders', 'provider_ref', { type: DataTypes.TEXT, allowNull: true });
  // Fiscal receipt (Phase 9d): issued by the POS after an online payment.
  await qi.addColumn('orders', 'fiscal_status', {
    type: DataTypes.ENUM('none', 'pending', 'issued', 'failed'),
    allowNull: false,
    defaultValue: 'none',
  });
  await qi.addColumn('orders', 'fiscal_invoice_number', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('orders', 'fiscal_verification_url', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('orders', 'fiscal_receipt_text', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('orders', 'fiscal_error', { type: DataTypes.TEXT, allowNull: true });
  // The POS's own reference for the opened order (ExternalId / receipt id).
  await qi.addColumn('orders', 'pos_ref', { type: DataTypes.TEXT, allowNull: true });

  await qi.createTable('payments', {
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
    provider: { type: DataTypes.ENUM('mock', 'otp'), allowNull: false },
    provider_ref: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'paid', 'failed', 'expired'), allowNull: false, defaultValue: 'pending' },
    // amount = base (order total) + tip; the webhook's amount is checked against it.
    base_cents: { type: DataTypes.INTEGER, allowNull: false },
    tip_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    amount_cents: { type: DataTypes.INTEGER, allowNull: false },
    qr_payload: { type: DataTypes.TEXT, allowNull: false },
    deep_link: { type: DataTypes.TEXT, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    // Last provider payload (webhook or status poll) for support.
    raw: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
  });
  await qi.addIndex('payments', ['provider', 'provider_ref'], { name: 'payments_provider_provider_ref_key', unique: true });
  await qi.addIndex('payments', ['order_id'], { name: 'payments_order_id_idx' });
  // The reconciliation job scans pending attempts across every restaurant.
  await qi.sequelize.query(`CREATE INDEX payments_pending_created_at_idx ON payments (created_at) WHERE status = 'pending'`);
};

export const down: Migration = async ({ context: qi }) => {
  await qi.dropTable('payments');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_payments_provider"');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status"');
  for (const column of [
    'pos_ref',
    'fiscal_error',
    'fiscal_receipt_text',
    'fiscal_verification_url',
    'fiscal_invoice_number',
    'fiscal_status',
    'provider_ref',
    'paid_at',
    'paid_amount_cents',
    'tip_cents',
    'payment_status',
  ]) {
    await qi.removeColumn('orders', column);
  }
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_status"');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_orders_fiscal_status"');
  await qi.removeColumn('restaurants', 'payment_config');
};
