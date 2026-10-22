import type { PublicMenuItemDto } from '@qr-menu/shared';
import { priceLabel } from '../lib/format';
import { allergenName, tagLabel, type Dictionary, type UiLocale } from '../lib/i18n';
import { AllergenGlyph, TagChip } from './Chips';
import { PlusIcon } from './icons';

interface Props {
  /** First rows of the first section: above the fold, so the image is fetched eagerly with high priority (LCP). */
  eager?: boolean;
  item: PublicMenuItemDto;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onOpen: (itemId: string) => void;
  /** Ordering enabled: available rows get a "+" (adds directly, or opens the sheet for items with variants). */
  onAdd?: ((item: PublicMenuItemDto) => void) | null;
}

const ROW = 'flex w-full items-start gap-3.5 py-4 text-left text-ink';

export function ItemRow({ item, currency, locale, t, onOpen, onAdd = null, eager = false }: Props) {
  const showMeta = item.tags.length > 0 || item.allergens.length > 0 || !item.isAvailable;
  const canAdd = Boolean(onAdd) && item.isAvailable;
  const text = (
    <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
      <span className="flex items-baseline justify-between gap-2.5">
        <span className="font-serif text-[17px] leading-[1.3] text-pretty">{item.name}</span>
        <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums">{priceLabel(item, currency, locale, t.from)}</span>
      </span>
      {item.description && <span className="block text-[13px] leading-[1.45] text-muted text-pretty">{item.description}</span>}
      {showMeta && (
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {item.tags.map((tag) => (
            <TagChip key={tag} tag={tag} label={tagLabel(t, tag)} />
          ))}
          {item.allergens.map((code) => (
            <AllergenGlyph key={code} code={code} name={allergenName(t, code)} />
          ))}
          {!item.isAvailable && <span className="text-xs font-medium text-muted italic">{t.unavailable}</span>}
        </span>
      )}
    </span>
  );
  const image = item.imageUrl && (
    <img
      src={item.thumbnailUrl ?? item.imageUrl}
      alt=""
      width={76}
      height={76}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      className="size-[76px] flex-none rounded-xl bg-placeholder object-cover max-[359px]:size-14"
    />
  );

  if (!item.isAvailable) {
    return (
      <li className="border-b border-line">
        <div className={`${ROW} opacity-45`} aria-disabled="true">
          {text}
          {image}
        </div>
      </li>
    );
  }

  if (!canAdd) {
    return (
      <li className="border-b border-line">
        <button type="button" onClick={() => onOpen(item.id)} aria-haspopup="dialog" className={`${ROW} cursor-pointer`}>
          {text}
          {image}
        </button>
      </li>
    );
  }

  // Ordering: the text opens the sheet, the "+" adds; the photo (if any) carries the "+" on its corner.
  return (
    <li className="flex items-start gap-3.5 border-b border-line">
      <button type="button" onClick={() => onOpen(item.id)} aria-haspopup="dialog" className={`${ROW} min-w-0 cursor-pointer`}>
        {text}
      </button>
      <div className={`relative flex-none py-4 ${image ? '' : 'w-11'}`}>
        {image && (
          <span onClick={() => onOpen(item.id)} className="block cursor-pointer" aria-hidden="true">
            {image}
          </span>
        )}
        <button
          type="button"
          onClick={() => onAdd?.(item)}
          aria-label={`${t.addToCart}: ${item.name}`}
          className={`grid size-11 place-items-center rounded-full border border-line bg-surface text-accent shadow-[0_2px_8px_rgba(31,26,23,.12)] ${
            image ? 'absolute -right-1.5 bottom-[10px]' : ''
          }`}
        >
          <PlusIcon />
        </button>
      </div>
    </li>
  );
}
