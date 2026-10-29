/** The templates ship as their own chunk; the modal loads it on open and the host prefetches it once promotions exist. */
export const loadPromotionView = () => import('../promotions');
