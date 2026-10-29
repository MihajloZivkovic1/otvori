import { WELCOME_STEPS_SR, type WelcomeEmailInput, type WelcomeEmailResultDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { Membership, Restaurant, User } from '../../db/models/index.js';
import type { AuthUser } from '../../types/express.js';
import { AppError, notFound } from '../../utils/errors.js';
import { sendWelcomeEmail, welcomeEmailText } from '../../utils/mailer.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import * as audit from '../audit/service.js';
import { issueOneTimeToken } from '../auth/service.js';
import { isSyntheticEmail } from '../team/service.js';

const SET_PASSWORD_TTL_MS = 7 * 86_400_000;

/**
 * POST /api/superadmin/restaurants/:id/welcome-email — the Serbian welcome mail to the owner: login URL, e-mail,
 * the password (only when the admin sends it along; it is never stored) or a 7-day set-password link, the admin's
 * contact and the first three steps.
 */
export async function sendWelcome(restaurantId: string, admin: AuthUser, input: WelcomeEmailInput): Promise<WelcomeEmailResultDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'name', 'slug'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  const memberships = await Membership.findAll({
    where: { restaurantId, ...(input.userId ? { userId: input.userId } : { role: 'owner' }) },
    include: [{ model: User, attributes: ['id', 'name', 'email', 'createdAt'] }],
  });
  const owner = memberships.map((m) => m.user).filter((u): u is User => Boolean(u)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (!owner) throw new AppError(409, 'CONFLICT', 'This venue has no owner yet — add one under Members first');
  if (isSyntheticEmail(owner.email)) throw new AppError(409, 'CONFLICT', `${owner.name} has no real e-mail address`);
  const adminUser = await User.findByPk(admin.id, { attributes: ['phone'] });
  const setPasswordUrl = input.password ? null : `${env.APP_URL}/auth/reset?token=${encodeURIComponent(await issueOneTimeToken(owner.id, 'password_reset', SET_PASSWORD_TTL_MS))}`;
  const info = {
    venue: restaurant.name,
    ownerName: owner.name,
    loginUrl: `${env.APP_URL}/login`,
    email: owner.email,
    password: input.password ?? null,
    setPasswordUrl,
    publicUrl: buildMenuUrl(restaurant.slug),
    contact: { name: admin.name, email: admin.email, phone: adminUser?.phone ?? null },
    steps: WELCOME_STEPS_SR,
    note: input.note ?? null,
  };
  await sendWelcomeEmail(info);
  await audit.record({
    restaurantId,
    action: 'admin.welcome_email',
    entity: { type: 'member', id: owner.id, label: owner.email },
    after: { includedPassword: Boolean(input.password), setPasswordLink: !input.password },
  });
  return { ok: true, to: owner.email, includedPassword: Boolean(input.password), text: welcomeEmailText(info) };
}
