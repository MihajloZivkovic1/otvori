import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ORDER_STATUSES, type OrderStatus } from '@qr-menu/shared';
import { OrderItem } from './order-item.model.js';
import { Restaurant } from './restaurant.model.js';
import { RestaurantTable } from './restaurant-table.model.js';

/** A guest's order for a table: a message to staff, not a transaction (guests pay the waiter as usual). */
@Table({ tableName: 'orders', timestamps: true, underscored: true })
export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  /** Null once the table was deleted; `tableNumber` keeps the snapshot. */
  @ForeignKey(() => RestaurantTable)
  @AllowNull(true)
  @Column(DataType.UUID)
  tableId!: CreationOptional<string | null>;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  tableNumber!: number;

  /** The guest's per-tab session id (the same uuid the menu app sends with analytics events). */
  @AllowNull(false)
  @Column(DataType.UUID)
  sessionId!: string;

  @AllowNull(false)
  @Default('new')
  @Column(DataType.ENUM(...ORDER_STATUSES))
  status!: CreationOptional<OrderStatus>;

  /** Daily sequential number per restaurant, shown as "#142". */
  @AllowNull(false)
  @Column(DataType.INTEGER)
  number!: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  guestName!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  note!: CreationOptional<string | null>;

  /** Computed server-side from the item snapshots; the client's total is ignored. */
  @AllowNull(false)
  @Column(DataType.INTEGER)
  totalCents!: number;

  /** Locale the guest was reading the menu in (names are snapshotted in it). */
  @AllowNull(false)
  @Column(DataType.TEXT)
  locale!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  rejectedReason!: CreationOptional<string | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @AllowNull(true)
  @Column(DataType.DATE)
  acceptedAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.DATE)
  deliveredAt!: CreationOptional<Date | null>;

  /** Set when the order reaches a final state (delivered, rejected, cancelled, expired). */
  @AllowNull(true)
  @Column(DataType.DATE)
  closedAt!: CreationOptional<Date | null>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => RestaurantTable)
  table?: NonAttribute<RestaurantTable>;

  @HasMany(() => OrderItem)
  items?: NonAttribute<OrderItem[]>;
}
