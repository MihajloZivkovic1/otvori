import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { TranslatedText } from '@qr-menu/shared';
import { ItemVariant } from './item-variant.model.js';
import { MenuItem } from './menu-item.model.js';
import { Order } from './order.model.js';

/** One line of an order. Everything a waiter needs is snapshotted so later menu edits never change an order. */
@Table({ tableName: 'order_items', timestamps: false, underscored: true })
export class OrderItem extends Model<InferAttributes<OrderItem>, InferCreationAttributes<OrderItem>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Order)
  @AllowNull(false)
  @Column(DataType.UUID)
  orderId!: string;

  /** Null once the menu item was deleted (ON DELETE SET NULL). */
  @ForeignKey(() => MenuItem)
  @AllowNull(true)
  @Column(DataType.UUID)
  menuItemId!: CreationOptional<string | null>;

  @ForeignKey(() => ItemVariant)
  @AllowNull(true)
  @Column(DataType.UUID)
  variantId!: CreationOptional<string | null>;

  /** Name snapshot: the guest's locale and the restaurant default locale. */
  @AllowNull(false)
  @Column(DataType.JSONB)
  name!: TranslatedText;

  @AllowNull(true)
  @Column(DataType.TEXT)
  variantName!: CreationOptional<string | null>;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  unitPriceCents!: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  quantity!: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lineNote!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: CreationOptional<number>;

  @BelongsTo(() => Order)
  order?: NonAttribute<Order>;

  @BelongsTo(() => MenuItem)
  menuItem?: NonAttribute<MenuItem>;

  @BelongsTo(() => ItemVariant)
  variant?: NonAttribute<ItemVariant>;
}
