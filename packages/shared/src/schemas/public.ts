import { z } from 'zod';
import { localeSchema, uuidSchema } from './common.js';

export const publicMenuQuerySchema = z.object({
  locale: localeSchema.optional(),
});
export type PublicMenuQuery = z.infer<typeof publicMenuQuerySchema>;

export const publicScanEventSchema = z.object({
  type: z.literal('scan'),
  sessionId: uuidSchema,
  tableNumber: z.coerce.number().int().min(1).max(9999).nullish(),
});

export const publicItemViewEventSchema = z.object({
  type: z.literal('item_view'),
  sessionId: uuidSchema,
  itemId: uuidSchema,
});

export const publicEventSchema = z.discriminatedUnion('type', [
  publicScanEventSchema,
  publicItemViewEventSchema,
]);
export type PublicEventInput = z.infer<typeof publicEventSchema>;
