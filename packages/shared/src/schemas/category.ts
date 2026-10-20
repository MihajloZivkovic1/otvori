import { z } from 'zod';
import { sortOrderSchema, translatedTextSchema } from './common.js';

const categoryFields = z.object({
  name: translatedTextSchema,
  isHidden: z.boolean(),
  sortOrder: sortOrderSchema,
});

export const createCategorySchema = categoryFields.partial({ isHidden: true, sortOrder: true });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = categoryFields.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
