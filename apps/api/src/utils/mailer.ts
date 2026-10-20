import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** In test mode every message is captured here so tests can read links out of it. */
export const outbox: MailMessage[] = [];

/**
 * Stub mailer: logs the message. Swap the body of `sendMail` for a real provider
 * (Resend, Postmark, SES...) without touching callers.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.isTest) outbox.push(message);
  logger.info({ mail: { from: env.MAIL_FROM, ...message } }, `[mail] "${message.subject}" → ${message.to}`);
}

export function sendMagicLink(email: string, url: string): Promise<void> {
  return sendMail({
    to: email,
    subject: 'Your Tabla sign-in link',
    text: `Sign in to Tabla by opening this link (valid for 15 minutes):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}

export function sendPasswordReset(email: string, url: string): Promise<void> {
  return sendMail({
    to: email,
    subject: 'Reset your Tabla password',
    text: `Reset your password by opening this link (valid for 1 hour):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}
