import { z } from 'zod';

export {
  forgotPasswordSchema,
  loginSchema,
  magicLinkRequestSchema,
  registerSchema,
  resetPasswordSchema,
} from '@qr-menu/shared';

export const tokenParamSchema = z.string().min(16).max(512);
