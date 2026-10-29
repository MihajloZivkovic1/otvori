import { PROMOTION_LIMITS, promotionDismissKey, type PublicPromotionDto } from '@qr-menu/shared';
import { readableOn } from './theme';

/**
 * Dismissals live in localStorage keyed by `${id}:${updatedAt}`: a closed modal stays closed for 24 h on that phone,
 * and an owner's edit (new updatedAt) makes it show again. Expired entries are pruned on read.
 */
const KEY = 'tabla.promo.dismissed';
const TTL_MS = PROMOTION_LIMITS.dismissHours * 3_600_000;

type Dismissed = Record<string, number>;

function read(now: number): Dismissed {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Dismissed = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'number' && now - value < TTL_MS) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function write(value: Dismissed): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — the modal simply shows again next time
  }
}

export function isPromotionDismissed(promotion: Pick<PublicPromotionDto, 'id' | 'updatedAt'>, now = Date.now()): boolean {
  return promotionDismissKey(promotion) in read(now);
}

export function dismissPromotion(promotion: Pick<PublicPromotionDto, 'id' | 'updatedAt'>, now = Date.now()): void {
  const current = read(now);
  // One entry per promotion: an edit replaces the old key instead of piling up.
  for (const key of Object.keys(current)) if (key.startsWith(`${promotion.id}:`)) delete current[key];
  current[promotionDismissKey(promotion)] = now;
  write(current);
}

/** The banner's collapsed state is per tab (sessionStorage) so a reload keeps the pill. */
const COLLAPSED_PREFIX = 'tabla.promo.collapsed.';

export function isBannerCollapsed(promotionId: string): boolean {
  try {
    return sessionStorage.getItem(COLLAPSED_PREFIX + promotionId) === '1';
  } catch {
    return false;
  }
}

export function setBannerCollapsed(promotionId: string, collapsed: boolean): void {
  try {
    if (collapsed) sessionStorage.setItem(COLLAPSED_PREFIX + promotionId, '1');
    else sessionStorage.removeItem(COLLAPSED_PREFIX + promotionId);
  } catch {
    // ignore
  }
}

/** Resolved accent: the promotion's own colour or the venue's. */
export function promotionAccent(promotion: Pick<PublicPromotionDto, 'accentColor'>, primaryColor: string): string {
  return promotion.accentColor ?? primaryColor;
}

/** Colours of the banner / pill / card chrome: accent as background unless the style overrides it, readable text on top. */
export function promotionChrome(promotion: Pick<PublicPromotionDto, 'accentColor' | 'style'>, primaryColor: string): { accent: string; background: string; text: string; pillPosition: 'left' | 'right' } {
  const accent = promotionAccent(promotion, primaryColor);
  const background = promotion.style?.backgroundColor ?? accent;
  const text = promotion.style?.textColor ?? readableOn(background);
  return { accent, background, text, pillPosition: promotion.style?.pillPosition ?? 'right' };
}

/** One line under the title for the banner / card. */
export function promotionSummary(promotion: PublicPromotionDto): string | null {
  switch (promotion.template) {
    case 'drink_list':
      return promotion.content.subtitle ?? promotion.content.entries.slice(0, 4).map((entry) => entry.name).join(' · ');
    case 'featured_items':
      return promotion.content.intro ?? promotion.items.map((item) => item.name).join(' · ');
    case 'deal':
      return promotion.content.headline;
    case 'notice':
      return promotion.content.headline;
  }
}
