import type { PublicMenuCategoryDto, PublicMenuItemDto } from '@qr-menu/shared';
import { sectionDomId } from '../hooks/useActiveCategory';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { ItemRow } from './ItemRow';

interface Props {
  category: PublicMenuCategoryDto;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onOpenItem: (itemId: string) => void;
  /** Ordering enabled: rows get a "+" button. */
  onAddItem?: ((item: PublicMenuItemDto) => void) | null;
}

export function CategorySection({ category, currency, locale, t, onOpenItem, onAddItem = null }: Props) {
  const domId = sectionDomId(category.id);
  return (
    <section
      id={domId}
      data-category-id={category.id}
      aria-labelledby={`${domId}-title`}
      className="scroll-mt-[61px] px-5 pt-7 pb-2"
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 id={`${domId}-title`} className="font-serif text-xl leading-[1.2] font-bold">
          {category.name}
        </h2>
        <span className="text-xs text-muted">{t.itemCount(category.items.length)}</span>
      </div>
      <ul>
        {category.items.map((item) => (
          <ItemRow key={item.id} item={item} currency={currency} locale={locale} t={t} onOpen={onOpenItem} onAdd={onAddItem} />
        ))}
      </ul>
    </section>
  );
}
