import type { TemplateProps } from '../types';

/** Template 4 — a plain announcement: headline and body, optional photo. */
export function Notice({ promotion, copy }: TemplateProps<'notice'>) {
  const { content } = promotion;
  return (
    <section className="promo promo-notice" aria-label={promotion.title}>
      <span className="promo-eyebrow">{copy.notice}</span>
      <h2 className="promo-headline">{content.headline}</h2>
      {promotion.imageUrl ? <img className="promo-image" src={promotion.imageUrl} alt="" /> : null}
      <p className="promo-body" style={{ whiteSpace: 'pre-line' }}>
        {content.body}
      </p>
    </section>
  );
}
