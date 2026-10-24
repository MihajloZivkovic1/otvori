import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 11 — owner PIN and permissions.
 *  - restaurants.owner_pin_hash: bcrypt of the 4-digit owner PIN (null = no PIN); digest_sent_on: last daily digest.
 *  - auth_tokens.session_id: stable id of a sign-in across refresh-token rotations (elevation tokens bind to it).
 *  - memberships.daily_digest: the member wants the morning summary mail.
 *  - team_invites: e-mail invites (token hash) and the venue's 6-digit join code (plain, 24 h).
 *  - audit_log: who changed what and when (90-day retention), including sign-ins, PIN events and order actions.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('restaurants', 'owner_pin_hash', { type: DataTypes.TEXT, allowNull: true });
  await qi.addColumn('restaurants', 'digest_sent_on', { type: DataTypes.DATEONLY, allowNull: true });

  await qi.addColumn('auth_tokens', 'session_id', { type: DataTypes.UUID, allowNull: true });
  await qi.sequelize.query(`UPDATE auth_tokens SET session_id = id WHERE session_id IS NULL`);

  await qi.addColumn('memberships', 'daily_digest', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });

  await qi.createTable('team_invites', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    restaurant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'restaurants', key: 'id' },
      onDelete: 'CASCADE',
    },
    kind: { type: DataTypes.ENUM('email', 'code'), allowNull: false },
    email: { type: DataTypes.CITEXT, allowNull: true },
    role: { type: DataTypes.ENUM('owner', 'staff'), allowNull: false, defaultValue: 'staff' },
    /** SHA-256 of the e-mail invite token; the raw token only ever lives in the mail. */
    token_hash: { type: DataTypes.TEXT, allowNull: true },
    /** The join code itself (6 digits, 24 h, shown again in the Team card while valid). */
    code: { type: DataTypes.TEXT, allowNull: true },
    invited_by: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await qi.addIndex('team_invites', ['restaurant_id'], { name: 'team_invites_restaurant_id_idx' });
  await qi.addIndex('team_invites', ['token_hash'], { name: 'team_invites_token_hash_idx' });
  await qi.addIndex('team_invites', ['code'], { name: 'team_invites_code_idx' });

  await qi.createTable('audit_log', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    restaurant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'restaurants', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    /** Snapshots so the row still reads after the member was removed or renamed. */
    user_name: { type: DataTypes.TEXT, allowNull: true },
    user_email: { type: DataTypes.TEXT, allowNull: true },
    role: { type: DataTypes.TEXT, allowNull: true },
    elevated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    action: { type: DataTypes.TEXT, allowNull: false },
    entity_type: { type: DataTypes.TEXT, allowNull: true },
    entity_id: { type: DataTypes.TEXT, allowNull: true },
    entity_label: { type: DataTypes.TEXT, allowNull: true },
    before: { type: DataTypes.JSONB, allowNull: true },
    after: { type: DataTypes.JSONB, allowNull: true },
    ip: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await qi.addIndex('audit_log', ['restaurant_id', 'created_at'], { name: 'audit_log_restaurant_created_idx' });
  await qi.addIndex('audit_log', ['restaurant_id', 'action'], { name: 'audit_log_restaurant_action_idx' });
  await qi.addIndex('audit_log', ['created_at'], { name: 'audit_log_created_at_idx' });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.dropTable('audit_log');
  await qi.dropTable('team_invites');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_team_invites_kind"');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_team_invites_role"');
  await qi.removeColumn('memberships', 'daily_digest');
  await qi.removeColumn('auth_tokens', 'session_id');
  await qi.removeColumn('restaurants', 'digest_sent_on');
  await qi.removeColumn('restaurants', 'owner_pin_hash');
};
