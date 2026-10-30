import { useId, useState } from 'react';
import { ORDERING_LIMITS, type PublicMenuItemDto } from '@qr-menu/shared';
import { formatPrice, priceLabel } from '../lib/format';
import { allergenName, tagLabel, type Dictionary, type UiLocale } from '../lib/i18n';
import { BottomSheet } from './BottomSheet';
import { TagChip } from './Chips';
import { Stepper } from './Stepper';

export interface AddSelection {
  variantId: string | null;
  quantity: number;
  note: string;
}

interface Props {
  item: PublicMenuItemDto;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onClose: () => void;
  /** Ordering enabled: variant radio, quantity stepper, line note and the "Add" button (design A2). */
  onAdd?: ((selection: AddSelection) => void) | null;
}

const LABEL = 'text-xs font-semibold tracking-[0.06em] text-muted uppercase';

/** Item detail bottom sheet (modal dialog). Opened via ?item=<id> so the browser Back button closes it. */
export function ItemSheet({ item, currency, locale, t, onClose, onAdd = null }: Props) {
  const titleId = `sheet-title-${item.id}`;
  const sizeId = useId();
  const variantLabel = item.variantLabel ?? t.size;
  const noteId = useId();
  const [variantId, setVariantId] = useState<string | null>(item.variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const variant = item.variants.find((candidate) => candidate.id === variantId) ?? null;
  const unitPriceCents = variant?.priceCents ?? item.priceCents;
  const allergenText =
    item.allergens.length > 0 ? item.allergens.map((code) => allergenName(t, code)).join(', ') : t.noAllergens;

  return (
    <BottomSheet labelledBy={titleId} onClose={onClose}>
      <div className="safe-bottom flex flex-col gap-[18px] px-5 pt-2">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" width={800} height={800} decoding="async" className="aspect-square max-h-[55vh] w-full rounded-[18px] bg-placeholder object-contain" />
        ) : (
          <div className="aspect-square max-h-[55vh] w-full rounded-[18px] bg-placeholder" aria-hidden="true" />
        )}

        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-serif text-2xl leading-[1.2] font-bold text-pretty">
            {item.name}
          </h2>
          <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
            {onAdd ? formatPrice(unitPriceCents, currency, locale) : priceLabel(item, currency, locale, t.from)}
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

        {item.variants.length > 0 &&
          (onAdd ? (
            <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={sizeId}>
              <h3 id={sizeId} className={LABEL}>
                {variantLabel}
              </h3>
              {item.variants.map((candidate) => {
                const selected = candidate.id === variantId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setVariantId(candidate.id)}
                    className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 text-left ${
                      selected ? 'border-accent bg-accent/10' : 'border-line'
                    }`}
                  >
                    <span className={`grid size-5 flex-none place-items-center rounded-full border-2 ${selected ? 'border-accent' : 'border-muted'}`} aria-hidden="true">
                      <span className={`size-2.5 rounded-full ${selected ? 'bg-accent' : ''}`} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{candidate.name}</span>
                    <span className="text-sm font-medium text-muted tabular-nums">{formatPrice(candidate.priceCents, currency, locale)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className={LABEL}>{variantLabel}</h3>
              <ul className="flex flex-col gap-2">
                {item.variants.map((candidate) => (
                  <li key={candidate.id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-3.5">
                    <span className="text-[15px] font-medium">{candidate.name}</span>
                    <span className="text-sm font-medium text-muted tabular-nums">{formatPrice(candidate.priceCents, currency, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        {onAdd ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className={LABEL}>{t.quantity}</h3>
              <Stepper value={quantity} min={1} max={ORDERING_LIMITS.maxQuantity} onChange={setQuantity} t={t} label={item.name} />
            </div>
            <label htmlFor={noteId} className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between">
                <span className={LABEL}>{t.lineNote}</span>
                <span className="text-xs text-muted tabular-nums">
                  {note.length}/{ORDERING_LIMITS.lineNoteMax}
                </span>
              </span>
              <input
                id={noteId}
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, ORDERING_LIMITS.lineNoteMax))}
                maxLength={ORDERING_LIMITS.lineNoteMax}
                placeholder={t.lineNotePlaceholder}
                className="h-12 rounded-xl border border-line bg-transparent px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => onAdd({ variantId, quantity, note: note.trim() })}
              className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-accent text-base font-semibold text-on-accent"
            >
              {t.add}{' '}
              <span className="opacity-75" aria-hidden="true">
                ·
              </span>{' '}
              <span className="tabular-nums">{formatPrice(unitPriceCents * quantity, currency, locale)}</span>
            </button>
            <p className="text-center text-xs text-muted">
              {t.allergens}: {allergenText}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 border-t border-line pt-1.5">
              <h3 className={LABEL}>{t.allergens}</h3>
              <p className="text-sm leading-[1.5]">{allergenText}</p>
            </div>
            <button type="button" onClick={onClose} className="h-12 rounded-[14px] border border-line text-[15px] font-semibold text-ink">
              {t.close}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
