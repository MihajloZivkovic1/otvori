import { z } from 'zod';
import { DRINK_LIST_ICONS, DRINK_LIST_VARIANTS, PILL_POSITIONS, PILL_STYLES, PROMOTION_DISPLAYS, PROMOTION_LIMITS, PROMOTION_TEMPLATES } from '../promotions.js';
import { hexColorSchema, isoDateTimeSchema, priceCentsSchema, uuidSchema } from './common.js';

export const promotionTemplateSchema = z.enum(PROMOTION_TEMPLATES);
export const promotionDisplaySchema = z.enum(PROMOTION_DISPLAYS);

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export const promotionRecurrenceSchema = z
  .object({
    /** ISO weekdays, 1 = Monday … 7 = Sunday. */
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'Pick at least one day')
      .max(7)
      .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique'),
    from: hhmmSchema,
    to: hhmmSchema,
  })
  .refine((value) => value.from !== value.to, { message: 'From and to must differ', path: ['to'] });
export type PromotionRecurrenceInput = z.infer<typeof promotionRecurrenceSchema>;

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const drinkListEntrySchema = z.object({
  name: shortText(PROMOTION_LIMITS.entryNameMax),
  lines: z.array(z.string().trim().min(1).max(PROMOTION_LIMITS.entryLineMax)).max(PROMOTION_LIMITS.entryLinesMax),
  menuItemId: uuidSchema.optional(),
});

export const drinkListContentSchema = z.object({
  subtitle: optionalText(PROMOTION_LIMITS.subtitleMax),
  logoText: optionalText(PROMOTION_LIMITS.logoTextMax),
  entries: z.array(drinkListEntrySchema).min(1, 'Add at least one entry').max(PROMOTION_LIMITS.entriesMax),
  columns: z.union([z.literal(1), z.literal(2)]),
  variant: z.enum(DRINK_LIST_VARIANTS).optional(),
  icons: z.enum(DRINK_LIST_ICONS).optional(),
});

export const promotionStyleSchema = z.object({
  textColor: hexColorSchema.nullable().optional(),
  backgroundColor: hexColorSchema.nullable().optional(),
  pillPosition: z.enum(PILL_POSITIONS).nullable().optional(),
  pillColor: hexColorSchema.nullable().optional(),
  pillStyle: z.enum(PILL_STYLES).nullable().optional(),
  pillTextColor: hexColorSchema.nullable().optional(),
});
export type PromotionStyleInput = z.infer<typeof promotionStyleSchema>;

export const featuredItemsContentSchema = z.object({
  intro: optionalText(PROMOTION_LIMITS.introMax),
  items: z
    .array(z.object({ menuItemId: uuidSchema, badge: optionalText(PROMOTION_LIMITS.badgeMax) }))
    .min(PROMOTION_LIMITS.featuredMin, 'Pick at least one item')
    .max(PROMOTION_LIMITS.featuredMax),
});

export const dealContentSchema = z.object({
  headline: shortText(PROMOTION_LIMITS.headlineMax),
  description: optionalText(PROMOTION_LIMITS.descriptionMax),
  priceCents: priceCentsSchema,
  oldPriceCents: priceCentsSchema.optional(),
  menuItemId: uuidSchema.optional(),
});

export const noticeContentSchema = z.object({
  headline: shortText(PROMOTION_LIMITS.headlineMax),
  body: shortText(PROMOTION_LIMITS.bodyMax),
});

/** `{ template, content }` — the content shape follows the template. */
export const promotionBodySchema = z.discriminatedUnion('template', [
  z.object({ template: z.literal('drink_list'), content: drinkListContentSchema }),
  z.object({ template: z.literal('featured_items'), content: featuredItemsContentSchema }),
  z.object({ template: z.literal('deal'), content: dealContentSchema }),
  z.object({ template: z.literal('notice'), content: noticeContentSchema }),
]);

const promotionFields = z.object({
  title: shortText(PROMOTION_LIMITS.titleMax),
  display: promotionDisplaySchema,
  /** null = the venue's primaryColor. */
  accentColor: hexColorSchema.nullable(),
  priority: z.number().int().min(PROMOTION_LIMITS.priorityMin).max(PROMOTION_LIMITS.priorityMax),
  isActive: z.boolean(),
  startsAt: isoDateTimeSchema.nullable(),
  endsAt: isoDateTimeSchema.nullable(),
  recurrence: promotionRecurrenceSchema.nullable(),
  /** Colour / pill overrides; null = template defaults. */
  style: promotionStyleSchema.nullable(),
  /** Set by the image upload route; a PATCH may only clear it. */
  imageUrl: z.null().optional(),
});

const createFields = promotionFields.partial({
  display: true,
  accentColor: true,
  priority: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  recurrence: true,
  style: true,
  imageUrl: true,
});

function datesInOrder(value: { startsAt?: string | null; endsAt?: string | null }): boolean {
  if (!value.startsAt || !value.endsAt) return true;
  return new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime();
}
const DATES_MESSAGE = { message: 'The end must be after the start', path: ['endsAt'] };

export const createPromotionSchema = z
  .discriminatedUnion('template', [
    createFields.extend({ template: z.literal('drink_list'), content: drinkListContentSchema }),
    createFields.extend({ template: z.literal('featured_items'), content: featuredItemsContentSchema }),
    createFields.extend({ template: z.literal('deal'), content: dealContentSchema }),
    createFields.extend({ template: z.literal('notice'), content: noticeContentSchema }),
  ])
  .refine(datesInOrder, DATES_MESSAGE);
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

const updateFields = promotionFields.partial();

/**
 * PATCH: any field; `template` + `content` always travel together (the content is validated against the template
 * it is sent with, so a template switch replaces the content in one request).
 */
export const updatePromotionSchema = z
  .union([
    updateFields.extend({ template: z.literal('drink_list'), content: drinkListContentSchema }),
    updateFields.extend({ template: z.literal('featured_items'), content: featuredItemsContentSchema }),
    updateFields.extend({ template: z.literal('deal'), content: dealContentSchema }),
    updateFields.extend({ template: z.literal('notice'), content: noticeContentSchema }),
    updateFields.extend({ template: z.undefined().optional(), content: z.undefined().optional() }),
  ])
  .refine(datesInOrder, DATES_MESSAGE);
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const togglePromotionSchema = z.object({ isActive: z.boolean() });
export type TogglePromotionInput = z.infer<typeof togglePromotionSchema>;
