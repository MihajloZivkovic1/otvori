import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** In test mode every message is captured here so tests can read links out of it. */
export const outbox: MailMessage[] = [];

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

/** Development/test provider: the message only goes to the log. */
export const logProvider: MailProvider = {
  async send(message) {
    logger.info({ mail: { from: env.MAIL_FROM, ...message } }, `[mail] "${message.subject}" → ${message.to}`);
  },
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Resend (https://resend.com) through its REST API — small enough that no SDK is needed. */
export function resendProvider(apiKey: string, from = env.MAIL_FROM, fetchImpl: typeof fetch = fetch): MailProvider {
  return {
    async send(message) {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend responded ${response.status}: ${body.slice(0, 300)}`);
      }
      const { id } = (await response.json()) as { id?: string };
      logger.info({ mail: { to: message.to, subject: message.subject, id } }, 'Mail sent via Resend');
    },
  };
}

function selectProvider(): MailProvider {
  if (env.MAIL_PROVIDER === 'resend') return resendProvider(env.RESEND_API_KEY!);
  if (env.isProduction) logger.warn('MAIL_PROVIDER=log: magic links and password resets are only written to the log');
  return logProvider;
}

const provider = selectProvider();

/** Send through the configured provider (MAIL_PROVIDER=log|resend). Callers never depend on the provider. */
export async function sendMail(message: MailMessage): Promise<void> {
  if (env.isTest) outbox.push(message);
  await provider.send(message);
}

export function sendMagicLink(email: string, url: string): Promise<void> {
  return sendMail({
    to: email,
    subject: 'Your salveta sign-in link',
    text: `Sign in to salveta by opening this link (valid for 15 minutes):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}

export function sendPasswordReset(email: string, url: string): Promise<void> {
  return sendMail({
    to: email,
    subject: 'Reset your salveta password',
    text: `Reset your password by opening this link (valid for 1 hour):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}
