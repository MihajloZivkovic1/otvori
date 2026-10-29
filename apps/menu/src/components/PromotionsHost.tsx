import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { PROMOTION_LIMITS, type PublicPromotionDto } from '@qr-menu/shared';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { dismissPromotion, isBannerCollapsed, isPromotionDismissed, promotionChrome, promotionSummary, setBannerCollapsed } from '../lib/promotions';
import { CloseIcon } from './icons';
import { loadPromotionView } from '../lib/promotion-view';
import { PromotionModal } from './PromotionModal';

interface HostProps {
  promotions: PublicPromotionDto[];
  primaryColor: string;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  /** The promotion the URL (`?promo=`) says is open, if any. */
  openId: string | null;
  onOpen: (promotionId: string) => void;
  onClose: () => void;
  /** Another overlay (item sheet, cart) is open: the auto modal waits. */
  busy: boolean;
  /** The cart bar is on screen: the banner and the pill sit above it. */
  raised: boolean;
  onOpenItem: (itemId: string) => void;
}

function prefetchWhenIdle(load: () => Promise<unknown>): () => void {
  const run = () => void load().catch(() => undefined);
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1200);
  return () => window.clearTimeout(handle);
}

/**
 * Everything the guest sees of promotions apart from the inline card (which `MenuPage` places above the first
 * category): the auto-opening modal (once, ~600 ms after the menu painted, unless dismissed in the last 24 h), the
 * bottom banner with its collapsed pill, and the full view opened from the banner / card.
 */
export function PromotionsHost({ promotions, primaryColor, currency, locale, t, openId, onOpen, onClose, busy, raised, onOpenItem }: HostProps) {
  const modal = promotions.find((promotion) => promotion.display === 'modal') ?? null;
  const banner = promotions.find((promotion) => promotion.display === 'banner') ?? null;
  const [autoModal, setAutoModal] = useState<PublicPromotionDto | null>(null);
  const shown = useRef(false);

  useEffect(() => (promotions.length > 0 ? prefetchWhenIdle(loadPromotionView) : undefined), [promotions.length]);

  // Never more than one modal: the API already sends at most one, and it is shown once per page load.
  useEffect(() => {
    if (!modal || shown.current || busy || openId || isPromotionDismissed(modal)) return;
    const handle = window.setTimeout(() => {
      shown.current = true;
      setAutoModal(modal);
    }, PROMOTION_LIMITS.modalDelayMs);
    return () => window.clearTimeout(handle);
  }, [modal, busy, openId]);

  const closeAutoModal = useCallback(() => {
    if (autoModal) dismissPromotion(autoModal);
    setAutoModal(null);
  }, [autoModal]);

  const opened = openId ? (promotions.find((promotion) => promotion.id === openId) ?? null) : null;
  const current = autoModal ?? opened;

  return (
    <>
      {banner && !current ? (
        <PromotionBanner promotion={banner} primaryColor={primaryColor} t={t} raised={raised} onOpen={() => onOpen(banner.id)} />
      ) : null}
      {current ? (
        <PromotionModal
          promotion={current}
          primaryColor={primaryColor}
          currency={currency}
          locale={locale}
          t={t}
          onClose={autoModal ? closeAutoModal : onClose}
          onOpenItem={(itemId) => {
            if (autoModal) closeAutoModal();
            else onClose();
            onOpenItem(itemId);
          }}
        />
      ) : null}
    </>
  );
}

interface BannerProps {
  promotion: PublicPromotionDto;
  primaryColor: string;
  t: Dictionary;
  raised: boolean;
  onOpen: () => void;
}

/** Fixed bottom bar: title + "View"; X collapses it to a pill in the bottom corner. Tapping the pill opens the promotion
 *  straight away (no second step); the banner stays collapsed afterwards. */
export function PromotionBanner({ promotion, primaryColor, t, raised, onOpen }: BannerProps) {
  const [collapsed, setCollapsed] = useState(() => isBannerCollapsed(promotion.id));
  const chrome = promotionChrome(promotion, primaryColor);
  const style = { background: chrome.background, color: chrome.text } as CSSProperties;
  const summary = promotionSummary(promotion);
  const collapse = (next: boolean) => {
    setBannerCollapsed(promotion.id, next);
    setCollapsed(next);
  };

  if (collapsed) {
    return (
      <div className={`pointer-events-none fixed inset-x-4 z-30 mx-auto flex max-w-[608px] transition-[bottom] ${chrome.pillPosition === 'left' ? 'justify-start' : 'justify-end'} ${raised ? 'bottom-[92px]' : 'safe-bottom-bar'}`}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${t.promo.expand}: ${promotion.title}`}
          style={style}
          className="pointer-events-auto flex h-10 max-w-[180px] items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(31,26,23,.24)]"
        >
          <SparkIcon />
          <span className="truncate">{promotion.title}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`${t.promo.promotion}: ${promotion.title}`}
      className={`pointer-events-none fixed inset-x-4 z-30 mx-auto max-w-[608px] transition-[bottom] ${raised ? 'bottom-[92px]' : 'safe-bottom-bar'}`}
    >
      <div style={style} className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-2xl py-2 pr-2 pl-4 shadow-[0_10px_30px_rgba(31,26,23,.28)]">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <SparkIcon />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] leading-tight font-semibold">{promotion.title}</span>
            {summary ? <span className="truncate text-xs leading-tight opacity-80">{summary}</span> : null}
          </span>
          <span className="flex-none rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: 'color-mix(in oklab, currentColor 18%, transparent)' }}>{t.promo.view}</span>
        </button>
        <button type="button" onClick={() => collapse(true)} aria-label={t.promo.collapse} className="grid size-9 flex-none place-items-center rounded-full opacity-80">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

interface CardProps {
  promotion: PublicPromotionDto;
  primaryColor: string;
  t: Dictionary;
  onOpen: () => void;
}

/** Inline card above the first category; tapping opens the full view. */
export function PromotionCard({ promotion, primaryColor, t, onOpen }: CardProps) {
  const chrome = promotionChrome(promotion, primaryColor);
  const accent = chrome.accent;
  const summary = promotionSummary(promotion);
  const image = promotion.imageUrl ?? (promotion.template === 'featured_items' || promotion.template === 'deal' ? (promotion.items[0]?.thumbnailUrl ?? promotion.items[0]?.imageUrl ?? null) : null);
  return (
    <div className="px-5 pt-6">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t.promo.promotion}: ${promotion.title}`}
        style={{ borderLeftColor: accent, ...(promotion.style?.backgroundColor ? { background: chrome.background, color: chrome.text } : {}) } as CSSProperties}
        className="flex w-full items-center gap-3.5 rounded-2xl border border-line border-l-[3px] bg-surface p-3.5 text-left text-ink shadow-[0_1px_2px_rgba(31,26,23,.04)]"
      >
        {image ? (
          <img src={image} alt="" width={56} height={56} loading="lazy" className="size-14 flex-none rounded-xl bg-placeholder object-cover" />
        ) : (
          <span className="grid size-11 flex-none place-items-center rounded-xl" style={{ background: accent, color: chrome.text === accent ? '#fff' : readableOnAccent(accent) }} aria-hidden="true">
            <SparkIcon />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: accent }}>
            {t.promo.promotion}
          </span>
          <span className="font-serif text-[17px] leading-[1.2]">{promotion.title}</span>
          {summary ? <span className="truncate text-[13px] text-muted">{summary}</span> : null}
        </span>
        <span className="flex-none text-sm font-semibold" style={{ color: accent }}>
          {t.promo.view} →
        </span>
      </button>
    </div>
  );
}

function readableOnAccent(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.55 ? '#1B1816' : '#FFFFFF';
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
    </svg>
  );
}
