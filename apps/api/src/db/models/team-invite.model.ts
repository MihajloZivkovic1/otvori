import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@qr-menu/shared';
import { Restaurant } from './restaurant.model.js';
import { User } from './user.model.js';

export const TEAM_INVITE_KINDS = ['email', 'code'] as const;
export type TeamInviteKind = (typeof TEAM_INVITE_KINDS)[number];

/** An e-mail invite (one-time token) or the venue's join code (reusable 6 digits, 24 h). Phase 11. */
@Table({ tableName: 'team_invites', timestamps: true, updatedAt: false, underscored: true })
export class TeamInvite extends Model<InferAttributes<TeamInvite>, InferCreationAttributes<TeamInvite>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...TEAM_INVITE_KINDS))
  kind!: TeamInviteKind;

  @AllowNull(true)
  @Column(DataType.CITEXT)
  email!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default('staff')
  @Column(DataType.ENUM(...MEMBERSHIP_ROLES))
  role!: CreationOptional<MembershipRole>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  tokenHash!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  code!: CreationOptional<string | null>;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.UUID)
  invitedBy!: CreationOptional<string | null>;

  @AllowNull(false)
  @Column(DataType.DATE)
  expiresAt!: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  usedAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.DATE)
  revokedAt!: CreationOptional<Date | null>;

  createdAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => User, 'invitedBy')
  inviter?: NonAttribute<User>;
}
