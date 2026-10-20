import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { MenuItem } from './menu-item.model.js';

@Table({ tableName: 'item_variants', timestamps: false, underscored: true })
export class ItemVariant extends Model<InferAttributes<ItemVariant>, InferCreationAttributes<ItemVariant>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => MenuItem)
  @AllowNull(false)
  @Column(DataType.UUID)
  menuItemId!: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  name!: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  priceCents!: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: CreationOptional<number>;

  @BelongsTo(() => MenuItem)
  menuItem?: NonAttribute<MenuItem>;
}
