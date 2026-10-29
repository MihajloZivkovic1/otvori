import { useMemo, useState } from 'react';
import type { CategoryDto, MenuItemDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { formatPrice, text } from '../../lib/format';
import { useCategories, useItems } from '../../lib/queries';
import { ItemThumb } from '../menu/ItemThumb';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface MenuItemPickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen items (one for a single pick). */
  onPick: (items: MenuItemDto[]) => void;
  multiple?: boolean;
  /** Upper bound for a multiple pick (counting `selectedIds`). */
  max?: number;
  /** Already chosen (multiple mode): shown ticked and not counted twice. */
  selectedIds?: readonly string[];
  title?: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

/** Searchable list of the venue's items grouped by category (drink list, featured items, deal). */
export function MenuItemPicker({ open, onClose, onPick, multiple = false, max, selectedIds = [], title = 'Pick from the menu' }: MenuItemPickerProps) {
  const { restaurant } = useRestaurantContext();
  const categories = useCategories(restaurant.id);
  const items = useItems(restaurant.id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const locale = restaurant.defaultLocale;

  const groups = useMemo(() => {
    const needle = normalize(query.trim());
    const byCategory = new Map<string, MenuItemDto[]>();
    for (const item of items.data ?? []) {
      if (needle && !normalize(text(item.name, locale)).includes(needle)) continue;
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }
    return (categories.data ?? [])
      .map((category: CategoryDto) => ({ category, items: byCategory.get(category.id) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [categories.data, items.data, locale, query]);

  const taken = new Set(selectedIds);
  const atMax = max !== undefined && taken.size + picked.length >= max;

  const choose = (item: MenuItemDto) => {
    if (!multiple) {
      onPick([item]);
      onClose();
      return;
    }
    setPicked((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : atMax ? prev : [...prev, item.id]));
  };

  const confirm = () => {
    const all = items.data ?? [];
    onPick(picked.map((id) => all.find((item) => item.id === id)).filter((item): item is MenuItemDto => Boolean(item)));
    setPicked([]);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      flush
      footer={
        multiple ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={picked.length === 0} onClick={confirm}>
              Add {picked.length > 0 ? `${picked.length} ${picked.length === 1 ? 'item' : 'items'}` : 'items'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 border-b border-line bg-surface p-3">
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items…" aria-label="Search items" data-autofocus />
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {items.isPending || categories.isPending ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{query ? 'Nothing matches.' : 'The menu has no items yet.'}</p>
        ) : (
          groups.map(({ category, items: rows }) => (
            <section key={category.id} aria-label={text(category.name, locale)}>
              <h3 className="sticky top-0 bg-canvas px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                {text(category.name, locale)}
                {category.isHidden ? ' · hidden' : ''}
              </h3>
              <ul>
                {rows.map((item) => {
                  const already = taken.has(item.id);
                  const selected = already || picked.includes(item.id);
                  const disabled = already || (multiple && !selected && atMax);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={multiple ? selected : undefined}
                        onClick={() => choose(item)}
                        className={cn(
                          'flex h-14 w-full cursor-pointer items-center gap-3 px-4 text-left text-ink hover:bg-line-2 disabled:cursor-default disabled:opacity-50',
                          selected && !already && 'bg-accent-soft',
                        )}
                      >
                        <ItemThumb src={item.thumbnailUrl ?? item.imageUrl} size={36} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{text(item.name, locale)}</span>
                          <span className="truncate text-xs text-muted">{text(item.description, locale) || (item.isEffectivelyAvailable ? '' : 'Unavailable')}</span>
                        </span>
                        <span className="text-xs tabular-nums text-muted">{formatPrice(item.priceCents, restaurant.currency)}</span>
                        {multiple ? (
                          <span aria-hidden="true" className={cn('grid size-5 place-items-center rounded-md border', selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong')}>
                            {selected ? '✓' : ''}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
