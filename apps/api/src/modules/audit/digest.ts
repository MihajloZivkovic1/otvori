import { Op } from 'sequelize';
import { isPriceChange } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { AuditLog, Membership, Restaurant, User } from '../../db/models/index.js';
import { logger } from '../../utils/logger.js';
import { sendDailyDigest, type DigestCounts } from '../../utils/mailer.js';
import { formatZonedDate, startOfDayInZone, zonedParts } from '../../utils/time.js';
import { isSyntheticEmail } from '../team/service.js';

/** Hour (venue local time) at which the digest goes out. */
export const DIGEST_HOUR = 7;

export function countsFor(rows: Pick<AuditLog, 'action' | 'before' | 'after'>[]): DigestCounts {
  const counts: DigestCounts = { priceChanges: 0, newItems: 0, deletedItems: 0, availability: 0, pinFailures: 0, lockouts: 0, ordersAccepted: 0, ordersRejected: 0, logins: 0, settings: 0, team: 0 };
  for (const row of rows) {
    if (row.action === 'item.update' && isPriceChange(row)) counts.priceChanges += 1;
    else if (row.action === 'pos.sync' && isPriceChange(row)) counts.priceChanges += 1;
    if (row.action === 'item.create') counts.newItems += 1;
    if (row.action === 'item.delete') counts.deletedItems += 1;
    if (row.action === 'item.availability') counts.availability += 1;
    if (row.action === 'auth.pin_failed') counts.pinFailures += 1;
    if (row.action === 'auth.pin_lockout') counts.lockouts += 1;
    if (row.action === 'order.accept') counts.ordersAccepted += 1;
    if (row.action === 'order.reject') counts.ordersRejected += 1;
    if (row.action === 'auth.login') counts.logins += 1;
    if (row.action.startsWith('restaurant.') || row.action.endsWith('_config.update')) counts.settings += 1;
    if (row.action.startsWith('team.') && row.action !== 'team.digest') counts.team += 1;
  }
  return counts;
}

/**
 * "Juče: 3 promene cena, 1 novi artikal, 2 pogrešna PIN-a" — once per venue per local day, at or after 07:00, to
 * every member who opted in. Days without anything to report send nothing.
 */
export async function runDailyDigest(now = new Date()): Promise<{ sent: number }> {
  const subscribed = await Membership.findAll({
    where: { dailyDigest: true },
    include: [
      { model: User, attributes: ['email', 'name'] },
      { model: Restaurant, attributes: ['id', 'name', 'timezone', 'digestSentOn'] },
    ],
  });
  const byRestaurant = new Map<string, { restaurant: Restaurant; emails: string[] }>();
  for (const m of subscribed) {
    if (!m.restaurant || !m.user || isSyntheticEmail(m.user.email)) continue;
    const entry = byRestaurant.get(m.restaurantId) ?? { restaurant: m.restaurant, emails: [] };
    entry.emails.push(m.user.email);
    byRestaurant.set(m.restaurantId, entry);
  }

  let sent = 0;
  for (const { restaurant, emails } of byRestaurant.values()) {
    const tz = restaurant.timezone;
    const today = formatZonedDate(now, tz);
    if (zonedParts(now, tz).hour < DIGEST_HOUR || restaurant.digestSentOn === today) continue;
    const from = startOfDayInZone(now, tz, -1);
    const to = startOfDayInZone(now, tz);
    const rows = await AuditLog.findAll({
      where: { restaurantId: restaurant.id, createdAt: { [Op.gte]: from, [Op.lt]: to } },
      attributes: ['action', 'before', 'after'],
    });
    await restaurant.update({ digestSentOn: today });
    const counts = countsFor(rows);
    if (rows.length === 0) continue;
    const historyUrl = `${env.APP_URL}/r/${restaurant.id}/settings/history`;
    for (const email of emails) {
      try {
        await sendDailyDigest(email, { venue: restaurant.name, date: formatZonedDate(from, tz), counts, historyUrl });
        sent += 1;
      } catch (err) {
        logger.error({ err, restaurantId: restaurant.id }, 'Digest mail failed');
      }
    }
  }
  return { sent };
}

/** Checks every 15 minutes which venues are past 07:00 local time and still owe yesterday's digest. */
export function startDigestJob(): () => void {
  const run = () => runDailyDigest().catch((err: unknown) => logger.error({ err }, 'Daily digest failed'));
  const timer = setInterval(run, 15 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
