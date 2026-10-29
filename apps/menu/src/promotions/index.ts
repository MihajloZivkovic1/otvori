/**
 * Promotion templates, shared with the CMS live preview through the `@qr-menu/menu/promotions` package export.
 * Nothing in here touches the network, the router or `import.meta.env`.
 */
import './promotions.css';

export { PromotionView, type PromotionViewProps } from './PromotionView';
export { DrinkList } from './templates/DrinkList';
export { FeaturedItems } from './templates/FeaturedItems';
export { Deal } from './templates/Deal';
export { Notice } from './templates/Notice';
export { HighballIcon, MargaritaIcon, SpritzIcon } from './templates/DrinkIcons';
export type { PromotionLike, TemplateProps } from './types';
export { itemById } from './types';
export { promotionCopy, type PromotionCopy, type UiLocale } from '../lib/i18n';
export { formatPrice } from '../lib/format';
export { readableOn } from '../lib/theme';
