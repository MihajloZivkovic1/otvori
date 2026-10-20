import type { PublicMenuItemDto } from '@qr-menu/shared';
import { priceLabel } from '../lib/format';
import { allergenName, tagLabel, type Dictionary, type UiLocale } from '../lib/i18n';
import { AllergenGlyph, TagChip } from './Chips';

interface Props {
  item: PublicMenuItemDto;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onOpen: (itemId: string) => void;
}

const ROW = 'flex w-full items-start gap-3.5 border-b border-line py-4 text-left text-ink';

export function ItemRow({ item, currency, locale, t, onOpen }: Props) {
  const showMeta = item.tags.length > 0 || item.allergens.length > 0 || !item.isAvailable;
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="font-serif text-[17px] leading-[1.3] text-pretty">{item.name}</span>
          <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums">
            {priceLabel(item, currency, locale, t.from)}
          </span>
        </span>
        {item.description && (
          <span className="block text-[13px] leading-[1.45] text-muted text-pretty">{item.description}</span>
        )}
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
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          width={76}
          height={76}
          loading="lazy"
          decoding="async"
          className="size-[76px] flex-none rounded-xl bg-placeholder object-cover max-[359px]:size-14"
        />
      )}
    </>
  );

  if (!item.isAvailable) {
    return (
      <li>
        <div className={`${ROW} opacity-45`} aria-disabled="true">
          {content}
        </div>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={() => onOpen(item.id)} aria-haspopup="dialog" className={`${ROW} cursor-pointer`}>
        {content}
      </button>
    </li>
  );
}
