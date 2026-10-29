import { formatPrice } from '../../lib/format';
import type { TemplateProps } from '../types';
import { itemById } from '../types';

/** Template 2 — one to three menu items (name, photo, price from the live menu) with an optional badge each. */
export function FeaturedItems({ promotion, currency, locale, copy, onOpenItem = null }: TemplateProps<'featured_items'>) {
  const { content } = promotion;
  return (
    <section className="promo promo-featured" aria-label={promotion.title}>
      <span className="promo-eyebrow">{copy.featured}</span>
      <h2 className="promo-headline">{promotion.title}</h2>
      {content.intro ? <p className="promo-body promo-muted">{content.intro}</p> : null}
      {promotion.imageUrl ? <img className="promo-image" src={promotion.imageUrl} alt="" /> : null}
      <ul className="promo-featured-list">
        {content.items.map((entry) => {
          const item = itemById(promotion, entry.menuItemId);
          if (!item) return null;
          const image = item.thumbnailUrl ?? item.imageUrl;
          return (
            <li key={entry.menuItemId} className={`promo-featured-item${item.isAvailable ? '' : ' promo-unavailable'}`}>
              {image ? <img src={image} alt="" width={72} height={72} loading="lazy" /> : <span className="promo-thumb" aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 14 }} />}
              <div className="promo-featured-text">
                <span className="promo-featured-name">{item.name}</span>
                {item.description ? <span className="promo-featured-desc">{item.description}</span> : null}
                <div className="promo-featured-meta">
                  <span className="promo-price">{formatPrice(item.priceCents, currency, locale)}</span>
                  {entry.badge ? <span className="promo-badge">{entry.badge}</span> : null}
                </div>
                {!item.isAvailable ? (
                  <span className="promo-muted" style={{ fontSize: 12 }}>
                    {copy.unavailable}
                  </span>
                ) : onOpenItem ? (
                  <button type="button" className="promo-link" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => onOpenItem(item.id)}>
                    {copy.seeInMenu} →
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
