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
import { Restaurant } from './restaurant.model.js';
import { ScanEvent } from './scan-event.model.js';

/** A physical table with its own QR code. Named RestaurantTable to avoid clashing with the @Table decorator. */
@Table({ tableName: 'tables', modelName: 'RestaurantTable', timestamps: true, updatedAt: false, underscored: true })
export class RestaurantTable extends Model<InferAttributes<RestaurantTable>, InferCreationAttributes<RestaurantTable>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  number!: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  label!: string;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: CreationOptional<number>;

  createdAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @HasMany(() => ScanEvent)
  scanEvents?: NonAttribute<ScanEvent[]>;
}
