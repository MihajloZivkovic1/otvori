/**
 * Promotions (Phase 14): venue-made announcements rendered on the guest menu as a modal, a bottom banner or an inline
 * card. Four templates; the content JSONB is validated per template (schemas/promotions.ts). Everything here is pure
 * so the API (active-now), the CMS (status chips, forms) and the menu app (dismissal) share one vocabulary.
 */

export const PROMOTION_TEMPLATES = ['drink_list', 'featured_items', 'deal', 'notice'] as const;
export type PromotionTemplate = (typeof PROMOTION_TEMPLATES)[number];

export const PROMOTION_DISPLAYS = ['modal', 'banner', 'card'] as const;
export type PromotionDisplay = (typeof PROMOTION_DISPLAYS)[number];

export const PROMOTION_LIMITS = {
  titleMax: 80,
  subtitleMax: 120,
  logoTextMax: 40,
  entriesMax: 40,
  entryNameMax: 60,
  entryLinesMax: 12,
  entryLineMax: 60,
  featuredMin: 1,
  featuredMax: 3,
  badgeMax: 20,
  introMax: 200,
  headlineMax: 80,
  descriptionMax: 300,
  bodyMax: 600,
  priorityMin: -100,
  priorityMax: 100,
  /** A dismissed modal stays hidden on that phone for this long (or until the owner edits the promotion). */
  dismissHours: 24,
  /** The modal appears this long after the menu has painted. */
  modalDelayMs: 600,
} as const;

/** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface PromotionRecurrence {
  weekdays: number[];
  /** "HH:mm" wall-clock time in the restaurant's time zone. */
  from: string;
  /** "HH:mm"; at or before `from` means the window runs past midnight into the next day. */
  to: string;
}

export function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Yesterday's ISO weekday (Monday after Sunday). */
export function previousWeekday(weekday: number): number {
  return weekday === 1 ? 7 : weekday - 1;
}

/**
 * Is a wall-clock moment (ISO weekday 1–7 and minute of day 0–1439, already converted to the venue's zone) inside
 * the recurrence? Windows whose `to` is at or before `from` cross midnight: "Fri 22:00–02:00" covers Friday from
 * 22:00 and Saturday until 02:00, so Saturday 01:00 counts through *Friday's* weekday.
 */
export function inRecurrenceWindow(recurrence: PromotionRecurrence, weekday: number, minuteOfDay: number): boolean {
  const from = parseHHmm(recurrence.from);
  const to = parseHHmm(recurrence.to);
  const days = new Set(recurrence.weekdays);
  if (from < to) return days.has(weekday) && minuteOfDay >= from && minuteOfDay < to;
  // Crosses midnight (or from === to → a full day starting at `from`).
  if (days.has(weekday) && minuteOfDay >= from) return true;
  return days.has(previousWeekday(weekday)) && minuteOfDay < to;
}

/* ------------------------------------------------------------------ content */

export interface DrinkListEntry {
  name: string;
  lines: string[];
  /** Set when the entry was picked from the menu (name + description copied at pick time). */
  menuItemId?: string;
}

export interface DrinkListContent {
  subtitle?: string;
  logoText?: string;
  entries: DrinkListEntry[];
  columns: 1 | 2;
}

export interface FeaturedItemsContent {
  intro?: string;
  items: { menuItemId: string; badge?: string }[];
}

export interface DealContent {
  headline: string;
  description?: string;
  priceCents: number;
  oldPriceCents?: number;
  menuItemId?: string;
}

export interface NoticeContent {
  headline: string;
  body: string;
}

export type PromotionBody =
  | { template: 'drink_list'; content: DrinkListContent }
  | { template: 'featured_items'; content: FeaturedItemsContent }
  | { template: 'deal'; content: DealContent }
  | { template: 'notice'; content: NoticeContent };

export type PromotionContentFor<T extends PromotionTemplate> = Extract<PromotionBody, { template: T }>['content'];

/** Every menu item a promotion refers to (the public endpoint embeds them resolved). */
export function promotionMenuItemIds(body: PromotionBody): string[] {
  const ids: (string | undefined)[] = [];
  switch (body.template) {
    case 'drink_list':
      ids.push(...body.content.entries.map((entry) => entry.menuItemId));
      break;
    case 'featured_items':
      ids.push(...body.content.items.map((item) => item.menuItemId));
      break;
    case 'deal':
      ids.push(body.content.menuItemId);
      break;
    case 'notice':
      break;
  }
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/* ------------------------------------------------------------------ status */

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'off';

/** CMS status chip: Active / Scheduled / Expired / Off, from the server-computed `isActiveNow`. */
export function promotionStatus(
  promotion: { isActive: boolean; isActiveNow: boolean; endsAt: string | null },
  now: Date = new Date(),
): PromotionStatus {
  if (!promotion.isActive) return 'off';
  if (promotion.isActiveNow) return 'active';
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < now.getTime()) return 'expired';
  return 'scheduled';
}

/** localStorage key under which the guest app remembers a dismissal; an owner edit (new updatedAt) resets it. */
export function promotionDismissKey(promotion: { id: string; updatedAt: string }): string {
  return `${promotion.id}:${promotion.updatedAt}`;
}
