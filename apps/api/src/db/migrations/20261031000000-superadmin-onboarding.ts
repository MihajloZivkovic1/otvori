import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 13 — superadmin area and venue onboarding.
 *  - users: phone (the admin's contact for the person), must_change_password (admin-set password), deactivated_at,
 *    last_login_at (shown on the Users / Members screens).
 *  - restaurants: billing_note + paid_until (manual invoicing), admin_notes (internal), onboarding_step (1–4 while
 *    the wizard is unfinished, null = done).
 *  - auth_tokens: ip + user_agent of the sign-in, for the account's sessions list.
 *  - audit_log.restaurant_id becomes nullable: platform-level rows (user deactivated, password reset sent by an
 *    admin) have no venue.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('users', 'phone', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('users', 'must_change_password', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  await qi.addColumn('users', 'deactivated_at', { type: DataTypes.DATE, allowNull: true });
  await qi.addColumn('users', 'last_login_at', { type: DataTypes.DATE, allowNull: true });

  await qi.addColumn('restaurants', 'billing_note', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('restaurants', 'paid_until', { type: DataTypes.DATEONLY, allowNull: true });
  await qi.addColumn('restaurants', 'admin_notes', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('restaurants', 'onboarding_step', { type: DataTypes.INTEGER, allowNull: true });

  await qi.addColumn('auth_tokens', 'ip', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('auth_tokens', 'user_agent', { type: DataTypes.TEXT, allowNull: true });

  // Plain SQL: Sequelize's changeColumn with `references` re-adds the FK instead of dropping the NOT NULL.
  await qi.sequelize.query('ALTER TABLE audit_log ALTER COLUMN restaurant_id DROP NOT NULL');
  await qi.addIndex('audit_log', ['user_id', 'created_at'], { name: 'audit_log_user_created_idx' });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.removeIndex('audit_log', 'audit_log_user_created_idx');
  await qi.sequelize.query('DELETE FROM audit_log WHERE restaurant_id IS NULL');
  await qi.sequelize.query('ALTER TABLE audit_log ALTER COLUMN restaurant_id SET NOT NULL');
  await qi.removeColumn('auth_tokens', 'user_agent');
  await qi.removeColumn('auth_tokens', 'ip');
  await qi.removeColumn('restaurants', 'onboarding_step');
  await qi.removeColumn('restaurants', 'admin_notes');
  await qi.removeColumn('restaurants', 'paid_until');
  await qi.removeColumn('restaurants', 'billing_note');
  await qi.removeColumn('users', 'last_login_at');
  await qi.removeColumn('users', 'deactivated_at');
  await qi.removeColumn('users', 'must_change_password');
  await qi.removeColumn('users', 'phone');
};
