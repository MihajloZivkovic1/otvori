import type { CSSProperties } from 'react';
import { readableOn } from '../lib/theme';
import { Deal } from './templates/Deal';
import { DrinkList } from './templates/DrinkList';
import { FeaturedItems } from './templates/FeaturedItems';
import { Notice } from './templates/Notice';
import type { PromotionLike, TemplateProps } from './types';

export interface PromotionViewProps extends Omit<TemplateProps, 'promotion'> {
  promotion: PromotionLike;
  /** Resolved accent (#rrggbb): the promotion's own colour or the venue's primaryColor. */
  accent: string;
  className?: string;
}

/** Renders a promotion with the template its body names; the accent travels as a CSS variable. */
export function PromotionView({ promotion, accent, className, ...rest }: PromotionViewProps) {
  const link = promotion.linkUrl ?? null;
  const overrides = promotion.style ?? null;
  const style = {
    '--promo-accent': accent,
    '--promo-on-accent': readableOn(accent),
    // `.promo` reads these through var() fallbacks, so an inline value here wins over the host tokens.
    ...(overrides?.textColor ? { '--promo-text': overrides.textColor, '--promo-muted-opacity': 0.72 } : {}),
    ...(overrides?.backgroundColor ? { '--promo-bg': overrides.backgroundColor, background: overrides.backgroundColor } : {}),
  } as CSSProperties;
  const body = (() => {
    switch (promotion.template) {
      case 'drink_list':
        return <DrinkList promotion={promotion} {...rest} />;
      case 'featured_items':
        return <FeaturedItems promotion={promotion} {...rest} />;
      case 'deal':
        return <Deal promotion={promotion} {...rest} />;
      case 'notice':
        return <Notice promotion={promotion} {...rest} />;
    }
  })();
  return (
    <div className={className ? `promo-root ${className}` : 'promo-root'} style={style} data-template={promotion.template}>
      {body}
      {link ? (
        <a className="promo-cta" href={link} target="_blank" rel="noopener noreferrer" data-testid="promotion-link">
          <span>{promotion.linkLabel ?? rest.copy.openLink}</span>
          <svg className="promo-cta-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6.5 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5" />
            <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
