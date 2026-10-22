import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, Column, DataType, Default, HasMany, Model, PrimaryKey, Table, Unique } from 'sequelize-typescript';
import {
  DEFAULT_MODULES,
  ORDERING_MODES,
  PLANS,
  RESTAURANT_DEFAULTS,
  RESTAURANT_STATUSES,
  THEMES,
  type OrderingMode,
  type Plan,
  type RestaurantModules,
  type RestaurantStatus,
  type Theme,
} from '@qr-menu/shared';
import { Category } from './category.model.js';
import { Membership } from './membership.model.js';
import { MenuItem } from './menu-item.model.js';
import { Order } from './order.model.js';
import { RestaurantTable } from './restaurant-table.model.js';
import { ScanEvent } from './scan-event.model.js';
import { ServiceRequest } from './service-request.model.js';

@Table({ tableName: 'restaurants', timestamps: true, underscored: true })
export class Restaurant extends Model<InferAttributes<Restaurant>, InferCreationAttributes<Restaurant>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @AllowNull(false)
  @Unique
  @Column(DataType.TEXT)
  slug!: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  name!: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  tagline!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  menuNote!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  logoUrl!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.primaryColor)
  @Column(DataType.TEXT)
  primaryColor!: CreationOptional<string>;

  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.theme)
  @Column(DataType.ENUM(...THEMES))
  theme!: CreationOptional<Theme>;

  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.currency)
  @Column(DataType.TEXT)
  currency!: CreationOptional<string>;

  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.defaultLocale)
  @Column(DataType.TEXT)
  defaultLocale!: CreationOptional<string>;

  @AllowNull(false)
  @Default([...RESTAURANT_DEFAULTS.supportedLocales])
  @Column(DataType.ARRAY(DataType.TEXT))
  supportedLocales!: CreationOptional<string[]>;

  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.timezone)
  @Column(DataType.TEXT)
  timezone!: CreationOptional<string>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  address!: CreationOptional<string | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  city!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default('trial')
  @Column(DataType.ENUM(...RESTAURANT_STATUSES))
  status!: CreationOptional<RestaurantStatus>;

  @AllowNull(false)
  @Default('trial')
  @Column(DataType.ENUM(...PLANS))
  plan!: CreationOptional<Plan>;

  @AllowNull(true)
  @Column(DataType.DATE)
  trialEndsAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.DATE)
  publishedAt!: CreationOptional<Date | null>;

  /** Feature modules (Phase 9b): { ordering, payments, pos }; all off = plain QR menu. */
  @AllowNull(false)
  @Default(() => ({ ...DEFAULT_MODULES }))
  @Column(DataType.JSONB)
  modules!: CreationOptional<RestaurantModules>;

  /** Table ordering: off (default, view-only menu), call_waiter or order. Only effective while modules.ordering. */
  @AllowNull(false)
  @Default(RESTAURANT_DEFAULTS.orderingMode)
  @Column(DataType.ENUM(...ORDERING_MODES))
  orderingMode!: CreationOptional<OrderingMode>;

  /** Paused: the menu shows `pausedMessage` and hides "+" and the cart; calls keep working. */
  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  orderingPaused!: CreationOptional<boolean>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  pausedMessage!: CreationOptional<string | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @HasMany(() => Category)
  categories?: NonAttribute<Category[]>;

  @HasMany(() => MenuItem)
  items?: NonAttribute<MenuItem[]>;

  @HasMany(() => RestaurantTable)
  tables?: NonAttribute<RestaurantTable[]>;

  @HasMany(() => Membership)
  memberships?: NonAttribute<Membership[]>;

  @HasMany(() => ScanEvent)
  scanEvents?: NonAttribute<ScanEvent[]>;

  @HasMany(() => Order)
  orders?: NonAttribute<Order[]>;

  @HasMany(() => ServiceRequest)
  serviceRequests?: NonAttribute<ServiceRequest[]>;
}
