import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, Column, DataType, Default, HasMany, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import { AuthToken } from './auth-token.model.js';
import { Membership } from './membership.model.js';

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @AllowNull(false)
  @Unique
  @Column(DataType.CITEXT)
  email!: string;

  /** Null for magic-link-only users. */
  @AllowNull(true)
  @Column(DataType.TEXT)
  passwordHash!: CreationOptional<string | null>;

  @AllowNull(false)
  @Column(DataType.TEXT)
  name!: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  isSuperadmin!: CreationOptional<boolean>;

  /** The superadmin's contact number for this person (Phase 13); never shown to other members. */
  @AllowNull(true)
  @Column(DataType.TEXT)
  phone!: CreationOptional<string | null>;

  /** A superadmin typed the password: the CMS asks for a new one on the first sign-in. */
  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  mustChangePassword!: CreationOptional<boolean>;

  /** Deactivated accounts cannot sign in and every session is revoked. */
  @AllowNull(true)
  @Column(DataType.DATE)
  deactivatedAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.DATE)
  lastLoginAt!: CreationOptional<Date | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @HasMany(() => Membership)
  memberships?: NonAttribute<Membership[]>;

  @HasMany(() => AuthToken)
  authTokens?: NonAttribute<AuthToken[]>;
}
