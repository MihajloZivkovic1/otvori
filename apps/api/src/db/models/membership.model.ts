import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@qr-menu/shared';
import { Restaurant } from './restaurant.model.js';
import { User } from './user.model.js';

@Table({ tableName: 'memberships', timestamps: false, underscored: true })
export class Membership extends Model<InferAttributes<Membership>, InferCreationAttributes<Membership>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  userId!: string;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...MEMBERSHIP_ROLES))
  role!: MembershipRole;

  /** Morning e-mail with yesterday's changes (Phase 11). */
  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  dailyDigest!: CreationOptional<boolean>;

  @BelongsTo(() => User)
  user?: NonAttribute<User>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;
}
