import type { CSSProperties } from 'react';
import { PromotionView, promotionCopy, type PromotionLike } from '@qr-menu/menu/promotions';
import type { UiLocale } from '@qr-menu/menu/promotions';
import { cn } from '../../lib/cn';

/** The guest menu's light palette, so the preview looks like the phone and not like the CMS. */
const GUEST_PALETTE = {
  '--bg': '#f7f2eb',
  '--surface': '#fffdf9',
  '--ink': '#1f1a17',
  '--muted': '#6e645c',
  '--line': 'rgba(31, 26, 23, 0.1)',
  '--chip': '#eee6db',
  '--placeholder': '#e8dccb',
} as CSSProperties;

interface PromotionPreviewProps {
  promotion: PromotionLike;
  accent: string;
  currency: string;
  locale: string;
  /** phone = 390 px device frame with the sheet chrome; plain = just the template (template picker). */
  variant?: 'phone' | 'plain';
  className?: string;
}

/** Live 390 px preview of a promotion exactly as the guest sees the full view (same components as apps/menu). */
export function PromotionPreview({ promotion, accent, currency, locale, variant = 'phone', className }: PromotionPreviewProps) {
  const copy = promotionCopy(locale);
  const uiLocale = (locale === 'sr' ? 'sr' : 'en') as UiLocale;
  if (variant === 'plain') {
    return (
      <div style={GUEST_PALETTE} className={cn('bg-[#fffdf9] text-[#1f1a17]', className)}>
        <PromotionView promotion={promotion} accent={accent} currency={currency} locale={uiLocale} copy={copy} />
      </div>
    );
  }
  return (
    <div
      aria-label="Live promotion preview"
      style={GUEST_PALETTE}
      className={cn('relative mx-auto w-[390px] max-w-full overflow-hidden rounded-[32px] bg-[#f7f2eb] text-[#1f1a17] shadow-[0_0_0_8px_#18181B,0_0_0_9px_#3F3F46,0_20px_50px_rgba(0,0,0,.25)]', className)}
    >
      <div className="flex items-center gap-2.5 px-5 pt-9 pb-3 opacity-40">
        <span className="size-9 rounded-xl bg-[#e8dccb]" />
        <span className="h-3.5 w-32 rounded bg-[#e8dccb]" />
      </div>
      <div className="rounded-t-[28px] bg-[#fffdf9] px-5 pt-3 pb-6">
        <div className="mb-2 flex justify-end">
          <span className="grid size-9 place-items-center rounded-full bg-[#eee6db]" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
        </div>
        <PromotionView promotion={promotion} accent={accent} currency={currency} locale={uiLocale} copy={copy} />
      </div>
    </div>
  );
}
