import { RichText } from '../../components/RichText';
import type { TemplateProps } from '../types';

/** Template 4 — a plain announcement: headline and body, optional photo. */
export function Notice({ promotion, copy }: TemplateProps<'notice'>) {
  const { content } = promotion;
  return (
    <section className="promo promo-notice" aria-label={promotion.title}>
      <span className="promo-eyebrow">{copy.notice}</span>
      <h2 className="promo-headline">{content.headline}</h2>
      {promotion.imageUrl ? <img className="promo-image" src={promotion.imageUrl} alt="" /> : null}
      <RichText text={content.body} className="promo-body" />
    </section>
  );
}
