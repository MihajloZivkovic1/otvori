import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { Restaurant } from './restaurant.model.js';
import { User } from './user.model.js';

/** "Who changed what and when" (Phase 11). Rows older than AUDIT_LIMITS.retentionDays are pruned. */
@Table({ tableName: 'audit_log', timestamps: true, updatedAt: false, underscored: true })
export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  /** Null for platform-level rows (a superadmin resetting a password, deactivating an account). */
  @ForeignKey(() => Restaurant)
  @AllowNull(true)
  @Column(DataType.UUID)
  restaurantId!: CreationOptional<string | null>;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.UUID)
  userId!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  userName!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  userEmail!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  role!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  elevated!: CreationOptional<boolean>;

  @AllowNull(false)
  @Column(DataType.TEXT)
  action!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  entityType!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  entityId!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  entityLabel!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.JSONB)
  before!: CreationOptional<Record<string, unknown> | null>;

  @AllowNull(true)
  @Column(DataType.JSONB)
  after!: CreationOptional<Record<string, unknown> | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  ip!: CreationOptional<string | null>;

  createdAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;
}
