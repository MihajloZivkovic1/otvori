import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import {
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPES,
  type ServiceRequestStatus,
  type ServiceRequestType,
} from '@qr-menu/shared';
import { Restaurant } from './restaurant.model.js';
import { RestaurantTable } from './restaurant-table.model.js';

/** "Call the waiter" / "The bill" from a table. At most one open request per type and table. */
@Table({ tableName: 'service_requests', timestamps: true, underscored: true })
export class ServiceRequest extends Model<InferAttributes<ServiceRequest>, InferCreationAttributes<ServiceRequest>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @ForeignKey(() => RestaurantTable)
  @AllowNull(false)
  @Column(DataType.UUID)
  tableId!: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  tableNumber!: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...SERVICE_REQUEST_TYPES))
  type!: ServiceRequestType;

  @AllowNull(false)
  @Default('open')
  @Column(DataType.ENUM(...SERVICE_REQUEST_STATUSES))
  status!: CreationOptional<ServiceRequestStatus>;

  createdAt!: CreationOptional<Date>;
  /** Bumped when the guest re-sends the same request while it is still open. */
  updatedAt!: CreationOptional<Date>;

  @AllowNull(true)
  @Column(DataType.DATE)
  doneAt!: CreationOptional<Date | null>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => RestaurantTable)
  table?: NonAttribute<RestaurantTable>;
}
