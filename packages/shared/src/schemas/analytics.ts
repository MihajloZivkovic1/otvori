import { z } from 'zod';
import { analyticsRangeSchema } from './common.js';

export const analyticsQuerySchema = z.object({
  range: analyticsRangeSchema.default('7d'),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
