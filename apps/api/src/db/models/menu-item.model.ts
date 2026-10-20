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
import type { TranslatedText } from '@qr-menu/shared';
import { Category } from './category.model.js';
import { ItemVariant } from './item-variant.model.js';
import { Restaurant } from './restaurant.model.js';

@Table({ tableName: 'menu_items', timestamps: true, underscored: true })
export class MenuItem extends Model<InferAttributes<MenuItem>, InferCreationAttributes<MenuItem>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @ForeignKey(() => Category)
  @AllowNull(false)
  @Column(DataType.UUID)
  categoryId!: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  name!: TranslatedText;

  @AllowNull(true)
  @Column(DataType.JSONB)
  description!: CreationOptional<TranslatedText | null>;

  /** Integer minor units (e.g. 25000 = 250,00 RSD). */
  @AllowNull(false)
  @Column(DataType.INTEGER)
  priceCents!: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  imageUrl!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default([])
  @Column(DataType.ARRAY(DataType.TEXT))
  allergens!: CreationOptional<string[]>;

  @AllowNull(false)
  @Default([])
  @Column(DataType.ARRAY(DataType.TEXT))
  tags!: CreationOptional<string[]>;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  isAvailable!: CreationOptional<boolean>;

  /** Temporarily unavailable until this instant; effective availability is computed from both fields. */
  @AllowNull(true)
  @Column(DataType.DATE)
  unavailableUntil!: CreationOptional<Date | null>;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: CreationOptional<number>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @BelongsTo(() => Category)
  category?: NonAttribute<Category>;

  @HasMany(() => ItemVariant)
  variants?: NonAttribute<ItemVariant[]>;
}
