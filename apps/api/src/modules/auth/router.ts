import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import * as controller from './controller.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, controller.register);
authRouter.post('/login', authLimiter, controller.login);
authRouter.post('/logout', controller.logout);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/magic-link', authLimiter, controller.requestMagicLink);
authRouter.get('/magic-link/:token', controller.consumeMagicLink);
authRouter.post('/forgot-password', authLimiter, controller.forgotPassword);
authRouter.post('/reset-password', authLimiter, controller.resetPassword);
authRouter.get('/me', requireAuth, controller.me);
// Team (Phase 11): e-mail invites and the 6-digit join code both end in a signed-in session.
authRouter.get('/invite/:token', authLimiter, controller.inviteInfo);
authRouter.post('/invite', authLimiter, controller.acceptInvite);
authRouter.post('/join', authLimiter, controller.joinWithCode);
