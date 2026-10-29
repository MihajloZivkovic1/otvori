import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

/** PATCH /api/auth/me — the signed-in person's own profile. Changing the e-mail needs the current password. */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: emailSchema,
    currentPassword: z.string().min(1).max(128),
  })
  .partial()
  .refine((d) => !d.email || Boolean(d.currentPassword), { message: 'Enter your password to change the e-mail', path: ['currentPassword'] });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** POST /api/auth/change-password — signs every other device out. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The CMS interface language and appearance (stored per browser, mirrored here for the account menu). */
export const CMS_LOCALES = ['en', 'sr'] as const;
export type CmsLocale = (typeof CMS_LOCALES)[number];
export const CMS_THEMES = ['system', 'light', 'dark'] as const;
export type CmsTheme = (typeof CMS_THEMES)[number];
