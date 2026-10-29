import type { PromotionBody, PromotionStyle, PublicPromotionItemDto } from '@qr-menu/shared';
import type { PromotionCopy, UiLocale } from '../lib/i18n';

/** What a template needs to render: the body plus the title, image and the resolved menu items it refers to. */
export type PromotionLike = PromotionBody & {
  title: string;
  imageUrl: string | null;
  items: PublicPromotionItemDto[];
  /** Colour overrides (text, background); the pill position is only read by the banner. */
  style?: PromotionStyle | null;
};

export interface TemplateProps<T extends PromotionLike['template'] = PromotionLike['template']> {
  promotion: Extract<PromotionLike, { template: T }>;
  currency: string;
  locale: UiLocale;
  copy: PromotionCopy;
  /** "See in menu" on a referenced item (guest app only; the CMS preview passes nothing). */
  onOpenItem?: ((itemId: string) => void) | null;
}

export function itemById(promotion: PromotionLike, itemId: string | undefined): PublicPromotionItemDto | null {
  if (!itemId) return null;
  return promotion.items.find((item) => item.id === itemId) ?? null;
}
