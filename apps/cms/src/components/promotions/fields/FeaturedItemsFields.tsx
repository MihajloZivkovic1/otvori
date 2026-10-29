import { useState } from 'react';
import { PROMOTION_LIMITS, type FeaturedItemsContent, type MenuItemDto } from '@qr-menu/shared';
import { text } from '../../../lib/format';
import { useItems } from '../../../lib/queries';
import { Icon } from '../../icons';
import { ItemThumb } from '../../menu/ItemThumb';
import { useRestaurantContext } from '../../shell/RestaurantLayout';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input, Textarea } from '../../ui/Field';
import { MenuItemPicker } from '../MenuItemPicker';

interface Props {
  value: FeaturedItemsContent;
  onChange: (next: FeaturedItemsContent) => void;
  error?: string;
}

/** Step 2 for featured items: an intro and 1–3 picked items, each with an optional badge. */
export function FeaturedItemsFields({ value, onChange, error }: Props) {
  const { restaurant } = useRestaurantContext();
  const items = useItems(restaurant.id);
  const [picking, setPicking] = useState(false);
  const chosen = value.items;
  const setItems = (next: FeaturedItemsContent['items']) => onChange({ ...value, items: next });
  const addPicked = (picked: MenuItemDto[]) => setItems([...chosen, ...picked.map((item) => ({ menuItemId: item.id }))].slice(0, PROMOTION_LIMITS.featuredMax));

  return (
    <div className="flex flex-col gap-5">
      <Field label="Intro" htmlFor="promo-intro" hint="Optional line under the title.">
        <Textarea id="promo-intro" rows={2} value={value.intro ?? ''} maxLength={PROMOTION_LIMITS.introMax} onChange={(event) => onChange({ ...value, intro: event.target.value })} />
      </Field>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            Items <span className="font-normal text-muted">· {chosen.length}/{PROMOTION_LIMITS.featuredMax}</span>
          </span>
          <Button size="sm" variant="primary" onClick={() => setPicking(true)} disabled={chosen.length >= PROMOTION_LIMITS.featuredMax}>
            Pick from menu
          </Button>
        </div>
        {error ? <p className="text-xs text-danger-text">{error}</p> : null}
        {chosen.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Pick one to three items. Name, photo and price come from the menu.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Featured items">
            {chosen.map((entry, index) => {
              const item = items.data?.find((candidate) => candidate.id === entry.menuItemId);
              return (
                <li key={entry.menuItemId} className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-3">
                  <ItemThumb src={item?.thumbnailUrl ?? item?.imageUrl ?? null} size={40} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item ? text(item.name, restaurant.defaultLocale) : 'Item'}</span>
                  <Input
                    value={entry.badge ?? ''}
                    maxLength={PROMOTION_LIMITS.badgeMax}
                    placeholder="Badge (e.g. New)"
                    aria-label={`Badge for ${item ? text(item.name, restaurant.defaultLocale) : `item ${index + 1}`}`}
                    className="w-36"
                    onChange={(event) => setItems(chosen.map((c, i) => (i === index ? { ...c, badge: event.target.value } : c)))}
                  />
                  <IconButton label={`Remove ${item ? text(item.name, restaurant.defaultLocale) : `item ${index + 1}`}`} size={28} onClick={() => setItems(chosen.filter((_, i) => i !== index))}>
                    <Icon name="trash" size={14} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <MenuItemPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={addPicked}
        multiple
        max={PROMOTION_LIMITS.featuredMax}
        selectedIds={chosen.map((entry) => entry.menuItemId)}
        title="Pick items to feature"
      />
    </div>
  );
}
