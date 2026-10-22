import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { POS_JOB_STATUSES, POS_JOB_TYPES, type PosJobStatus, type PosJobType } from '@qr-menu/shared';
import { Order } from './order.model.js';
import { Restaurant } from './restaurant.model.js';

export interface PosJobPayload {
  /** close_order: what to fiscalise (the order total without the tip) and how it was paid. */
  amountCents?: number;
  paymentKind?: 'instant' | 'cash';
}

/** One call to the register, retried with backoff until it succeeds or gives up (`failed`). */
@Table({ tableName: 'pos_jobs', timestamps: true, underscored: true })
export class PosJob extends Model<InferAttributes<PosJob>, InferCreationAttributes<PosJob>> {
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
  @Column(DataType.ENUM(...POS_JOB_TYPES))
  type!: PosJobType;

  @AllowNull(false)
  @Default('queued')
  @Column(DataType.ENUM(...POS_JOB_STATUSES))
  status!: CreationOptional<PosJobStatus>;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  attempts!: CreationOptional<number>;

  @AllowNull(false)
  @Default(() => new Date())
  @Column(DataType.DATE)
  nextRunAt!: CreationOptional<Date>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lastError!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload!: CreationOptional<PosJobPayload | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => Order)
  order?: NonAttribute<Order>;
}
