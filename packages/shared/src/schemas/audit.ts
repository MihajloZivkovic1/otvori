import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_KINDS, AUDIT_LIMITS } from '../security.js';
import { isoDateTimeSchema, uuidSchema } from './common.js';

export const auditActionSchema = z.enum(AUDIT_ACTIONS);
export const auditKindSchema = z.enum(AUDIT_KINDS);

/** GET /admin/restaurants/:id/audit-log */
export const listAuditQuerySchema = z.object({
  kind: auditKindSchema.default('all'),
  action: auditActionSchema.optional(),
  userId: uuidSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(AUDIT_LIMITS.maxPageSize).default(AUDIT_LIMITS.pageSize),
});
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
