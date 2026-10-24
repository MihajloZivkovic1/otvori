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
    subject: 'Your otvori sign-in link',
    text: `Sign in to otvori by opening this link (valid for 15 minutes):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}

/** The fiscal receipt of an order paid online (Phase 9d): text + the tax authority's verification link. */
export function sendFiscalReceipt(
  email: string,
  receipt: { venue: string; orderNumber: number; invoiceNumber: string; verificationUrl: string; text: string },
): Promise<void> {
  return sendMail({
    to: email,
    subject: `${receipt.venue} · fiskalni račun ${receipt.invoiceNumber}`,
    text:
      `Hvala na poseti — u prilogu je fiskalni račun za narudžbinu #${receipt.orderNumber} (${receipt.venue}).\n` +
      `Thank you for your visit — this is the fiscal receipt for order #${receipt.orderNumber} (${receipt.venue}).\n\n` +
      `Proveri račun / verify: ${receipt.verificationUrl}\n\n${receipt.text}\n\n— otvori.menu`,
  });
}

export function sendPasswordReset(email: string, url: string): Promise<void> {
  return sendMail({
    to: email,
    subject: 'Reset your otvori password',
    text: `Reset your password by opening this link (valid for 1 hour):\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
  });
}

/* ------------------------------------------------------------------ Phase 11: owner PIN, team, digest */

export function sendPinLockoutAlert(email: string, info: { venue: string; lockouts: number; historyUrl: string }): Promise<void> {
  return sendMail({
    to: email,
    subject: `${info.venue} · owner PIN locked ${info.lockouts} times today`,
    text:
      `Someone entered a wrong owner PIN for ${info.venue} five times in a row — that is lockout number ${info.lockouts} in the last 24 hours.\n` +
      `Neko je ${info.lockouts}. put danas pet puta zaredom uneo pogrešan PIN vlasnika za ${info.venue}.\n\n` +
      `Every attempt is in the change history: ${info.historyUrl}\n\n` +
      `If this was not you or your staff, change the PIN in Settings → Protection (your password is needed).\n\n— otvori.menu`,
  });
}

export function sendTeamInvite(
  email: string,
  info: { venue: string; inviter: string; role: 'owner' | 'staff'; url: string },
): Promise<void> {
  const role = info.role === 'owner' ? 'an owner' : 'staff';
  return sendMail({
    to: email,
    subject: `${info.inviter} invited you to ${info.venue} on otvori`,
    text:
      `${info.inviter} added you to ${info.venue} as ${role}. Open this link to join (valid for 7 days):\n\n${info.url}\n\n` +
      `${info.inviter} te je dodao/la u ${info.venue}. Otvori link da pristupiš (važi 7 dana).\n\n— otvori.menu`,
  });
}

export interface DigestCounts {
  priceChanges: number;
  newItems: number;
  deletedItems: number;
  availability: number;
  pinFailures: number;
  lockouts: number;
  ordersAccepted: number;
  ordersRejected: number;
  logins: number;
  settings: number;
  team: number;
}

/** Serbian plural forms: 1 promena, 2–4 promene, 5+ promena. */
export function srPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** "Juče: 3 promene cena, 1 novi artikal, 2 pogrešna PIN-a" — only the non-zero parts. */
export function digestSummary(c: DigestCounts): string {
  const parts: string[] = [];
  if (c.priceChanges) parts.push(`${c.priceChanges} ${srPlural(c.priceChanges, 'promena cene', 'promene cena', 'promena cena')}`);
  if (c.newItems) parts.push(`${c.newItems} ${srPlural(c.newItems, 'novi artikal', 'nova artikla', 'novih artikala')}`);
  if (c.deletedItems) parts.push(`${c.deletedItems} ${srPlural(c.deletedItems, 'obrisan artikal', 'obrisana artikla', 'obrisanih artikala')}`);
  if (c.availability) parts.push(`${c.availability} ${srPlural(c.availability, 'promena dostupnosti', 'promene dostupnosti', 'promena dostupnosti')}`);
  if (c.ordersAccepted) parts.push(`${c.ordersAccepted} ${srPlural(c.ordersAccepted, 'prihvaćena narudžbina', 'prihvaćene narudžbine', 'prihvaćenih narudžbina')}`);
  if (c.ordersRejected) parts.push(`${c.ordersRejected} ${srPlural(c.ordersRejected, 'odbijena narudžbina', 'odbijene narudžbine', 'odbijenih narudžbina')}`);
  if (c.pinFailures) parts.push(`${c.pinFailures} ${srPlural(c.pinFailures, 'pogrešan PIN', 'pogrešna PIN-a', 'pogrešnih PIN-ova')}`);
  if (c.lockouts) parts.push(`${c.lockouts} ${srPlural(c.lockouts, 'zaključavanje', 'zaključavanja', 'zaključavanja')}`);
  if (c.settings) parts.push(`${c.settings} ${srPlural(c.settings, 'promena podešavanja', 'promene podešavanja', 'promena podešavanja')}`);
  if (c.team) parts.push(`${c.team} ${srPlural(c.team, 'promena tima', 'promene tima', 'promena tima')}`);
  if (c.logins) parts.push(`${c.logins} ${srPlural(c.logins, 'prijava', 'prijave', 'prijava')}`);
  return parts.length ? `Juče: ${parts.join(', ')}` : 'Juče: bez promena';
}

export function sendDailyDigest(
  email: string,
  info: { venue: string; date: string; counts: DigestCounts; historyUrl: string },
): Promise<void> {
  const summary = digestSummary(info.counts);
  return sendMail({
    to: email,
    subject: `${info.venue} · ${summary}`,
    text:
      `${info.venue}, ${info.date}\n${summary}.\n\n` +
      `Ko je šta promenio i kad / who changed what and when: ${info.historyUrl}\n\n` +
      `Ovaj dnevni pregled možeš isključiti u Podešavanja → Zaštita.\n— otvori.menu`,
  });
}
