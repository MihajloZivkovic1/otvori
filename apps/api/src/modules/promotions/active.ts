import { inRecurrenceWindow, type PromotionRecurrence } from '@qr-menu/shared';
import { zonedParts } from '../../utils/time.js';

export interface PromotionSchedule {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  recurrence: PromotionRecurrence | null;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar date. */
export function isoWeekday(year: number, month: number, day: number): number {
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

/**
 * "Active now" = is_active AND (starts_at null or <= now) AND (ends_at null or >= now) AND (recurrence null or `now`,
 * seen as wall-clock time in the venue's zone, falls inside a recurrence window — including windows that started
 * yesterday and run past midnight).
 */
export function isPromotionActiveNow(promotion: PromotionSchedule, timezone: string, now: Date = new Date()): boolean {
  if (!promotion.isActive) return false;
  const t = now.getTime();
  if (promotion.startsAt && promotion.startsAt.getTime() > t) return false;
  if (promotion.endsAt && promotion.endsAt.getTime() < t) return false;
  if (!promotion.recurrence) return true;
  const parts = zonedParts(now, timezone);
  return inRecurrenceWindow(promotion.recurrence, isoWeekday(parts.year, parts.month, parts.day), parts.hour * 60 + parts.minute);
}
