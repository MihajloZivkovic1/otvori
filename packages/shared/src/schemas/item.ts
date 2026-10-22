import { z } from 'zod';
import { AVAILABILITY_UNTIL_PRESETS } from '../constants.js';
import {
  allergenSchema,
  isoDateTimeSchema,
  priceCentsSchema,
  sortOrderSchema,
  tagSchema,
  translatedTextOrEmptySchema,
  translatedTextSchema,
  uuidSchema,
} from './common.js';

export const itemVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceCents: priceCentsSchema,
  sortOrder: sortOrderSchema.optional(),
});
export type ItemVariantInput = z.infer<typeof itemVariantInputSchema>;

const itemFields = z.object({
  categoryId: uuidSchema,
  name: translatedTextSchema,
  description: translatedTextOrEmptySchema.nullable(),
  priceCents: priceCentsSchema,
  allergens: z.array(allergenSchema).max(20),
  tags: z.array(tagSchema).max(10),
  isAvailable: z.boolean(),
  unavailableUntil: isoDateTimeSchema.nullable(),
  sortOrder: sortOrderSchema,
  /** Replace-all semantics: the provided list becomes the item's full variant list. */
  variants: z.array(itemVariantInputSchema).max(30),
  /** POS product code (Phase 9d); required for ordering while the venue sends orders to the register. */
  posProductCode: z.string().trim().max(64).nullable(),
});

export const createItemSchema = itemFields.partial({
  description: true,
  allergens: true,
  tags: true,
  isAvailable: true,
  unavailableUntil: true,
  sortOrder: true,
  variants: true,
  posProductCode: true,
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = itemFields.partial();
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const listItemsQuerySchema = z.object({
  categoryId: uuidSchema.optional(),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

/**
 * PATCH /items/:id/availability
 * - { available: true }                  → available, clears unavailable_until
 * - { available: false }                 → unavailable indefinitely
 * - { available: false, until: <when> }  → temporarily unavailable until <when>
 *   where <when> is 'tomorrow-06:00' (next 06:00 in the restaurant's time zone) or an ISO date-time.
 */
export const availabilitySchema = z.object({
  available: z.boolean(),
  until: z.union([z.enum(AVAILABILITY_UNTIL_PRESETS), isoDateTimeSchema]).optional(),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
