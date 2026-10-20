import { z } from 'zod';
import { sortOrderSchema } from './common.js';

const tableFields = z.object({
  number: z.number().int().min(1).max(9999),
  label: z.string().trim().min(1).max(50),
  sortOrder: sortOrderSchema,
});

export const createTableSchema = tableFields.partial({ label: true, sortOrder: true });
export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = tableFields.partial();
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
