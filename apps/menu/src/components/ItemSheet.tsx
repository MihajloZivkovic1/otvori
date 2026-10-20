import { useRef } from 'react';
import type { PublicMenuItemDto } from '@qr-menu/shared';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { formatPrice, priceLabel } from '../lib/format';
import { allergenName, tagLabel, type Dictionary, type UiLocale } from '../lib/i18n';
import { TagChip } from './Chips';

interface Props {
  item: PublicMenuItemDto;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onClose: () => void;
}

const LABEL = 'text-xs font-semibold tracking-[0.06em] text-muted uppercase';

/** Item detail bottom sheet (modal dialog). Opened via ?item=<id> so the browser Back button closes it. */
export function ItemSheet({ item, currency, locale, t, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll(true);
  useFocusTrap(sheetRef, onClose);

  const titleId = `sheet-title-${item.id}`;
  const allergenText =
    item.allergens.length > 0 ? item.allergens.map((code) => allergenName(t, code)).join(', ') : t.noAllergens;

  return (
    <div className="fixed inset-0 z-50">
      <div className="scrim-enter absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-enter no-scrollbar absolute inset-x-0 bottom-0 mx-auto max-h-[88%] w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface text-ink outline-none"
      >
        <div className="sticky top-0 z-10 flex justify-center bg-surface pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-sm bg-line" />
        </div>
        <div className="safe-bottom flex flex-col gap-[18px] px-5 pt-2">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              width={800}
              height={800}
              decoding="async"
              className="h-60 w-full rounded-[18px] bg-placeholder object-cover"
            />
          ) : (
            <div className="h-60 rounded-[18px] bg-placeholder" aria-hidden="true" />
          )}

          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="font-serif text-2xl leading-[1.2] font-bold text-pretty">
              {item.name}
            </h2>
            <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
              {priceLabel(item, currency, locale, t.from)}
            </span>
          </div>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <TagChip key={tag} tag={tag} label={tagLabel(t, tag)} size="md" />
              ))}
            </div>
          )}

          {item.description && <p className="text-[15px] leading-[1.55] text-pretty">{item.description}</p>}

          {item.variants.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className={LABEL}>{t.size}</h3>
              <ul className="flex flex-col gap-2">
                {item.variants.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-3.5"
                  >
                    <span className="text-[15px] font-medium">{variant.name}</span>
                    <span className="text-sm font-medium text-muted tabular-nums">
                      {formatPrice(variant.priceCents, currency, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-line pt-1.5">
            <h3 className={LABEL}>{t.allergens}</h3>
            <p className="text-sm leading-[1.5]">{allergenText}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-[14px] border border-line text-[15px] font-semibold text-ink"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
