import { Suspense, lazy, useCallback, useRef, type TouchEvent } from 'react';
import type { PublicPromotionDto } from '@qr-menu/shared';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { loadPromotionView } from '../lib/promotion-view';
import { promotionAccent } from '../lib/promotions';
import { CloseIcon } from './icons';

const PromotionView = lazy(() => loadPromotionView().then((module) => ({ default: module.PromotionView })));

interface Props {
  promotion: PublicPromotionDto;
  primaryColor: string;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onClose: () => void;
  onOpenItem?: ((itemId: string) => void) | null;
}

/** How far a downward swipe (started with the content scrolled to the top) must travel to close. */
const SWIPE_CLOSE_PX = 72;

/**
 * The full view of a promotion: a centred modal (a tall portrait card for the drink list) with a backdrop. Closes on
 * X, a tap outside, Escape or a swipe down; focus is trapped, body scroll locked, `aria-modal` set.
 */
export function PromotionModal({ promotion, primaryColor, currency, locale, t, onClose, onOpenItem = null }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  useLockBodyScroll(true);
  useFocusTrap(dialogRef, onClose);
  const titleId = `promo-title-${promotion.id}`;
  const accent = promotionAccent(promotion, primaryColor);

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    touchStart.current = node.scrollTop <= 0 ? (event.touches[0]?.clientY ?? null) : null;
  }, []);
  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      const end = event.changedTouches[0]?.clientY;
      if (start !== null && end !== undefined && end - start > SWIPE_CLOSE_PX) onClose();
    },
    [onClose],
  );

  return (
    <div className="fixed inset-0 z-50" data-testid="promotion-modal">
      <div className="scrim-enter absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={promotion.style?.backgroundColor ? { background: promotion.style.backgroundColor, color: promotion.style.textColor ?? undefined } : undefined}
          className="sheet-enter no-scrollbar pointer-events-auto relative max-h-[94dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface text-ink outline-none sm:max-h-[90vh] sm:rounded-[28px]"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 pt-3 pb-2" style={{ background: promotion.style?.backgroundColor ?? 'var(--surface)' }}>
            <span className="h-1 w-10 rounded-sm bg-line sm:hidden" aria-hidden="true" />
            <h2 id={titleId} className="sr-only">
              {promotion.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.promo.close}
              data-autofocus
              className="ml-auto grid size-9 place-items-center rounded-full bg-chip text-ink"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="safe-bottom px-5 pt-1 sm:pb-6">
            <Suspense fallback={<div className="skeleton h-60 w-full rounded-2xl" aria-busy="true" />}>
              <PromotionView promotion={promotion} accent={accent} currency={currency} locale={locale} copy={t.promo} onOpenItem={onOpenItem} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
