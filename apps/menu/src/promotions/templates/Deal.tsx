import { formatPrice } from '../../lib/format';
import type { TemplateProps } from '../types';
import { itemById } from '../types';

/** Template 3 — one offer: headline, price (and the old one struck through), optional item and photo. */
export function Deal({ promotion, currency, locale, copy, onOpenItem = null }: TemplateProps<'deal'>) {
  const { content } = promotion;
  const item = itemById(promotion, content.menuItemId);
  const image = promotion.imageUrl ?? item?.imageUrl ?? null;
  return (
    <section className="promo promo-deal" aria-label={promotion.title}>
      <span className="promo-eyebrow">{copy.deal}</span>
      <h2 className="promo-headline">{content.headline}</h2>
      {image ? <img className="promo-image" src={image} alt="" /> : null}
      <div className="promo-deal-prices">
        <span className="promo-deal-price">{formatPrice(content.priceCents, currency, locale)}</span>
        {content.oldPriceCents !== undefined && content.oldPriceCents > content.priceCents ? (
          <span className="promo-old-price" aria-label={`${copy.oldPrice} ${formatPrice(content.oldPriceCents, currency, locale)}`}>
            {formatPrice(content.oldPriceCents, currency, locale)}
          </span>
        ) : null}
      </div>
      {content.description ? <p className="promo-body">{content.description}</p> : null}
      {item ? (
        <div className={`promo-deal-item${item.isAvailable ? '' : ' promo-unavailable'}`}>
          {item.thumbnailUrl ?? item.imageUrl ? <img src={item.thumbnailUrl ?? item.imageUrl ?? ''} alt="" width={56} height={56} loading="lazy" /> : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="promo-featured-name">{item.name}</div>
            <div className="promo-muted" style={{ fontSize: 13 }}>
              {item.isAvailable ? formatPrice(item.priceCents, currency, locale) : copy.unavailable}
            </div>
          </div>
          {item.isAvailable && onOpenItem ? (
            <button type="button" className="promo-link" style={{ fontSize: 13 }} onClick={() => onOpenItem(item.id)}>
              {copy.seeInMenu} →
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
