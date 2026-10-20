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
import { ItemView } from './item-view.model.js';
import { Restaurant } from './restaurant.model.js';
import { RestaurantTable } from './restaurant-table.model.js';

@Table({ tableName: 'scan_events', timestamps: false, underscored: true })
export class ScanEvent extends Model<InferAttributes<ScanEvent>, InferCreationAttributes<ScanEvent>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @ForeignKey(() => RestaurantTable)
  @AllowNull(true)
  @Column(DataType.UUID)
  tableId!: CreationOptional<string | null>;

  /** Client-generated UUID that groups a visitor's views within one visit. */
  @AllowNull(false)
  @Column(DataType.UUID)
  sessionId!: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  scannedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => RestaurantTable)
  table?: NonAttribute<RestaurantTable>;

  @HasMany(() => ItemView)
  itemViews?: NonAttribute<ItemView[]>;
}
