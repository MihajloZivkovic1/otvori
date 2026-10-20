import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { MenuItem } from './menu-item.model.js';
import { ScanEvent } from './scan-event.model.js';

@Table({ tableName: 'item_views', timestamps: false, underscored: true })
export class ItemView extends Model<InferAttributes<ItemView>, InferCreationAttributes<ItemView>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => ScanEvent)
  @AllowNull(false)
  @Column(DataType.UUID)
  scanEventId!: string;

  @ForeignKey(() => MenuItem)
  @AllowNull(false)
  @Column(DataType.UUID)
  menuItemId!: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  viewedAt!: CreationOptional<Date>;

  @BelongsTo(() => ScanEvent)
  scanEvent?: NonAttribute<ScanEvent>;

  @BelongsTo(() => MenuItem)
  menuItem?: NonAttribute<MenuItem>;
}
