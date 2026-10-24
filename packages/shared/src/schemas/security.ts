import { z } from 'zod';
import { ELEVATION_WINDOWS, PIN_LIMITS, weakPinReason } from '../security.js';

export const pinSchema = z
  .string()
  .length(PIN_LIMITS.length, `The PIN must be exactly ${PIN_LIMITS.length} digits`)
  .regex(/^\d+$/, 'The PIN may only contain digits');

/** Strict version for setting a PIN: also refuses the common / trivial ones. */
export const newPinSchema = pinSchema.refine((pin) => weakPinReason(pin) === null, {
  error: (issue) => weakPinReason(String(issue.input)) ?? 'Weak PIN',
});

const currentPasswordSchema = z.string().min(1, 'Your password is required').max(128);

/** PUT /admin/restaurants/:id/security/pin — set or change the owner PIN (the password confirms it is the owner). */
export const setPinSchema = z.object({ pin: newPinSchema, password: currentPasswordSchema });
export type SetPinInput = z.infer<typeof setPinSchema>;

/** DELETE /admin/restaurants/:id/security/pin */
export const removePinSchema = z.object({ password: currentPasswordSchema });
export type RemovePinInput = z.infer<typeof removePinSchema>;

export const elevationWindowSchema = z.enum(ELEVATION_WINDOWS);

/** POST /admin/restaurants/:id/security/unlock — the PIN from the keypad, or the password on the owner's own device. */
export const unlockSchema = z
  .object({
    pin: pinSchema.optional(),
    password: currentPasswordSchema.optional(),
    window: elevationWindowSchema.default('5'),
  })
  .refine((v) => Boolean(v.pin) !== Boolean(v.password), { message: 'Send either a PIN or a password' });
export type UnlockInput = z.infer<typeof unlockSchema>;

/** PATCH /admin/restaurants/:id/security — per-member preferences (the daily digest mail). */
export const updateSecuritySchema = z.object({ dailyDigest: z.boolean() }).partial();
export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>;
