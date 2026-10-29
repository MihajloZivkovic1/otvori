import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from 'sequelize';
import { AllowNull, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import type { PromotionBody, PromotionDisplay, PromotionRecurrence, PromotionTemplate } from '@qr-menu/shared';
import { Restaurant } from './restaurant.model.js';

export type PromotionContent = PromotionBody['content'];

/** A venue announcement on the guest menu (Phase 14). `content` follows `template` (shared promotionBodySchema). */
@Table({ tableName: 'promotions', timestamps: true, underscored: true })
export class Promotion extends Model<InferAttributes<Promotion>, InferCreationAttributes<Promotion>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: CreationOptional<string>;

  @ForeignKey(() => Restaurant)
  @AllowNull(false)
  @Column(DataType.UUID)
  restaurantId!: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  title!: string;

  @AllowNull(false)
  @Column(DataType.ENUM('drink_list', 'featured_items', 'deal', 'notice'))
  template!: PromotionTemplate;

  @AllowNull(false)
  @Column(DataType.JSONB)
  content!: PromotionContent;

  @AllowNull(false)
  @Default('card')
  @Column(DataType.ENUM('modal', 'banner', 'card'))
  display!: CreationOptional<PromotionDisplay>;

  /** null = the venue's primaryColor. */
  @AllowNull(true)
  @Column(DataType.TEXT)
  accentColor!: CreationOptional<string | null>;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  priority!: CreationOptional<number>;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: CreationOptional<boolean>;

  @AllowNull(true)
  @Column(DataType.DATE)
  startsAt!: CreationOptional<Date | null>;

  @AllowNull(true)
  @Column(DataType.DATE)
  endsAt!: CreationOptional<Date | null>;

  /** `{ weekdays (ISO 1–7), from 'HH:mm', to 'HH:mm' }` in the venue's time zone; `to` may be past midnight. */
  @AllowNull(true)
  @Column(DataType.JSONB)
  recurrence!: CreationOptional<PromotionRecurrence | null>;

  @AllowNull(true)
  @Column(DataType.TEXT)
  imageUrl!: CreationOptional<string | null>;

  createdAt!: CreationOptional<Date>;
  updatedAt!: CreationOptional<Date>;

  @BelongsTo(() => Restaurant)
  restaurant?: NonAttribute<Restaurant>;
}
