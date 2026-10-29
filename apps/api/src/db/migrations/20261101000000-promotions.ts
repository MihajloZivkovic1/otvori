import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 14 — promotions: venue announcements shown on the guest menu (modal / banner / card) rendered from one of
 * four templates. `content` is JSONB whose shape follows `template` (shared `promotionBodySchema`); `recurrence`
 * is `{ weekdays, from, to }` in the venue's time zone (`to` may be past midnight).
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.createTable('promotions', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    restaurant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'restaurants', key: 'id' },
      onDelete: 'CASCADE',
    },
    title: { type: DataTypes.TEXT, allowNull: false },
    template: { type: DataTypes.ENUM('drink_list', 'featured_items', 'deal', 'notice'), allowNull: false },
    content: { type: DataTypes.JSONB, allowNull: false },
    display: { type: DataTypes.ENUM('modal', 'banner', 'card'), allowNull: false, defaultValue: 'card' },
    /** null = the venue's primaryColor. */
    accent_color: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    starts_at: { type: DataTypes.DATE, allowNull: true },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    recurrence: { type: DataTypes.JSONB, allowNull: true },
    image_url: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await qi.addIndex('promotions', ['restaurant_id', 'is_active', 'priority'], { name: 'promotions_restaurant_active_priority_idx' });
};

export const down: Migration = async ({ context: qi }) => {
  await qi.dropTable('promotions');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_promotions_template"');
  await qi.sequelize.query('DROP TYPE IF EXISTS "enum_promotions_display"');
};
