import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import {
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_PROVIDERS,
  type PaymentAttemptStatus,
  type PaymentProviderKey,
} from '@qr-menu/shared';
import { Order } from './order.model.js';
import { Restaurant } from './restaurant.model.js';

/** One payment attempt at the provider for one order (the guest may retry after a failure or an expiry). */
@Table({ tableName: 'payments', timestamps: true, underscored: true })
export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @ForeignKey(() => Order)
  @AllowNull(false)
  @Column(DataType.UUID)
  orderId!: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...PAYMENT_PROVIDERS))
  provider!: PaymentProviderKey;

  /** The provider's reference; webhooks and status polls are matched on it (unique per provider). */
  @AllowNull(false)
  @Column(DataType.TEXT)
  providerRef!: string;

  @AllowNull(false)
  @Default('pending')
  @Column(DataType.ENUM(...PAYMENT_ATTEMPT_STATUSES))
  status!: CreationOptional<PaymentAttemptStatus>;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  baseCents!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  tipCents!: CreationOptional<number>;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  amountCents!: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  qrPayload!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  deepLink!: CreationOptional<string | null>;

  @AllowNull(false)
  @Column(DataType.DATE)
  expiresAt!: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  paidAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.JSONB)
  raw!: CreationOptional<Record<string, unknown> | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => Order)
  order?: NonAttribute<Order>;
}
