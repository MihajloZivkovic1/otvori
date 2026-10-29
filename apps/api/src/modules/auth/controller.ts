import type { CookieOptions, Request, Response } from 'express';
import { acceptInviteSchema, changePasswordSchema, joinWithCodeSchema, updateProfileSchema, type AuthResponseDto, type InvitePreviewDto, type MeDto, type OkDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { noStore, uuidParam } from '../../utils/http.js';
import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkRequestSchema,
  registerSchema,
  resetPasswordSchema,
  tokenParamSchema,
} from './schemas.js';
import * as account from './account.js';
import * as authService from './service.js';
import type { Session } from './service.js';
import { previewInvite } from '../team/service.js';

const COOKIE_PATH = '/api/auth';

function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: COOKIE_PATH,
    ...(expires ? { expires } : {}),
  };
}

function refreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[env.REFRESH_COOKIE_NAME];
}

function sendSession(res: Response, session: Session, status = 200): void {
  res.cookie(env.REFRESH_COOKIE_NAME, session.refreshToken, cookieOptions(session.refreshExpiresAt));
  noStore(res);
  const body: AuthResponseDto = {
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: session.user,
    memberships: session.memberships,
    ...(session.elevations ? { elevations: session.elevations } : {}),
  };
  res.status(status).json(body);
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  sendSession(res, await authService.register(input), 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  sendSession(res, await authService.login(input, req.ip ?? null, req.get('user-agent') ?? null));
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(refreshCookie(req));
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
  noStore(res);
  const body: OkDto = { ok: true };
  res.json(body);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    sendSession(res, await authService.refresh(refreshCookie(req)));
  } catch (error) {
    if (error instanceof AppError) res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions());
    throw error;
  }
}

export async function requestMagicLink(req: Request, res: Response): Promise<void> {
  const { email } = magicLinkRequestSchema.parse(req.body);
  await authService.requestMagicLink(email);
  noStore(res);
  const body: OkDto = { ok: true };
  res.json(body);
}

export async function consumeMagicLink(req: Request, res: Response): Promise<void> {
  const token = tokenParamSchema.parse(req.params.token);
  sendSession(res, await authService.consumeMagicLink(token, req.ip ?? null));
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(email);
  noStore(res);
  const body: OkDto = { ok: true };
  res.json(body);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  sendSession(res, await authService.resetPassword(token, password, req.ip ?? null));
}

export async function me(req: Request, res: Response): Promise<void> {
  const body: MeDto = await authService.me(req.user!.id);
  noStore(res);
  res.json(body);
}

/* ------------------------------------------------------------------ account (Phase 13c) */

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = updateProfileSchema.parse(req.body);
  noStore(res);
  res.json(await account.updateProfile(req.user!, input));
}

/** The new password signs every other device out; this one gets a fresh session (and cookie) in the answer. */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const input = changePasswordSchema.parse(req.body);
  sendSession(res, await account.changePassword(req.user!, input, { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null }));
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await account.listSessions(req.user!));
}

export async function revokeOtherSessions(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await account.revokeOtherSessions(req.user!));
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  noStore(res);
  res.json(await account.revokeSession(req.user!, uuidParam(req.params.id)));
}

/* ------------------------------------------------------------------ team (Phase 11) */

/** GET /api/auth/invite/:token — what the invite page shows before the person accepts. */
export async function inviteInfo(req: Request, res: Response): Promise<void> {
  const token = tokenParamSchema.parse(req.params.token);
  noStore(res);
  const body: InvitePreviewDto = await previewInvite(token);
  res.json(body);
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const input = acceptInviteSchema.parse(req.body);
  sendSession(res, await authService.acceptInvite(input, req.ip ?? null), 201);
}

export async function joinWithCode(req: Request, res: Response): Promise<void> {
  const input = joinWithCodeSchema.parse(req.body);
  sendSession(res, await authService.joinWithCode(input, req.ip ?? null), 201);
}
