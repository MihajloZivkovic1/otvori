import { z } from 'zod';
import { emailSchema, membershipRoleSchema, passwordSchema } from './common.js';
import { TEAM_LIMITS } from '../security.js';

/** POST /admin/restaurants/:id/team/invites */
export const createInviteSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema.default('staff'),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/** PATCH /admin/restaurants/:id/team/:membershipId */
export const updateMemberSchema = z.object({ role: membershipRoleSchema });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

const nameSchema = z.string().trim().min(1, 'Name is required').max(100);

/** POST /api/auth/invite — accept an e-mail invite; new accounts need a name and may set a password. */
export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(512),
  name: nameSchema.optional(),
  password: passwordSchema.optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const joinCodeSchema = z
  .string()
  .trim()
  .length(TEAM_LIMITS.joinCodeLength, `The code has ${TEAM_LIMITS.joinCodeLength} digits`)
  .regex(/^\d+$/, 'The code has digits only');

/** POST /api/auth/join — a waiter creates a staff account with the venue's join code. E-mail is optional. */
export const joinWithCodeSchema = z.object({
  code: joinCodeSchema,
  name: nameSchema,
  email: emailSchema.optional(),
  password: passwordSchema,
});
export type JoinWithCodeInput = z.infer<typeof joinWithCodeSchema>;
