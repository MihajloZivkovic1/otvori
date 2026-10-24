import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { AUTH_TOKEN_TYPES, type AuthTokenType } from '@qr-menu/shared';
import { User } from './user.model.js';

@Table({ tableName: 'auth_tokens', timestamps: true, updatedAt: false, underscored: true })
export class AuthToken extends Model<InferAttributes<AuthToken>, InferCreationAttributes<AuthToken>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  userId!: string;

  /** SHA-256 hex of the opaque token; the raw token is never stored. */
  @AllowNull(false)
  @Column(DataType.TEXT)
  tokenHash!: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...AUTH_TOKEN_TYPES))
  type!: AuthTokenType;

  @AllowNull(false)
  @Column(DataType.DATE)
  expiresAt!: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  usedAt!: CreationOptional<Date | null>;

  /**
   * Stable id of one sign-in: carried over when the refresh token rotates, embedded as `sid` in access tokens and
   * what elevation tokens (owner PIN) are bound to. Null on one-time tokens.
   */
  @AllowNull(true)
  @Column(DataType.UUID)
  sessionId!: CreationOptional<string | null>;

  createdAt!: CreationOptional<Date>;

  @BelongsTo(() => User)
  user?: NonAttribute<User>;
}
