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
import { MenuItem } from './menu-item.model.js';
import { Restaurant } from './restaurant.model.js';

@Table({ tableName: 'categories', timestamps: true, underscored: true })
export class Category extends Model<InferAttributes<Category>, InferCreationAttributes<Category>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  name!: TranslatedText;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: CreationOptional<number>;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  isHidden!: CreationOptional<boolean>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;

  @HasMany(() => MenuItem)
  items?: NonAttribute<MenuItem[]>;
}
