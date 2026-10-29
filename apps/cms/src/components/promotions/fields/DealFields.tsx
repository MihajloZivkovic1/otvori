import { useState } from 'react';
import { PROMOTION_LIMITS, type DealContent } from '@qr-menu/shared';
import { text } from '../../../lib/format';
import { useItems } from '../../../lib/queries';
import { PriceInput } from '../../menu/PriceInput';
import { useRestaurantContext } from '../../shell/RestaurantLayout';
import { Button } from '../../ui/Button';
import { Field, Input, Textarea } from '../../ui/Field';
import { MenuItemPicker } from '../MenuItemPicker';

interface Props {
  value: DealContent;
  onChange: (next: DealContent) => void;
  error?: string;
}

/** Step 2 for a deal: headline, description, the price and the old price, an optional linked item. */
export function DealFields({ value, onChange, error }: Props) {
  const { restaurant } = useRestaurantContext();
  const items = useItems(restaurant.id);
  const [picking, setPicking] = useState(false);
  const linked = value.menuItemId ? items.data?.find((item) => item.id === value.menuItemId) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Field label="Headline" htmlFor="promo-headline" error={error?.startsWith('headline') ? error : undefined}>
        <Input id="promo-headline" value={value.headline} maxLength={PROMOTION_LIMITS.headlineMax} placeholder="2 coffees for the price of 1" onChange={(event) => onChange({ ...value, headline: event.target.value })} />
      </Field>
      <Field label="Description" htmlFor="promo-description" hint="Optional.">
        <Textarea id="promo-description" rows={3} value={value.description ?? ''} maxLength={PROMOTION_LIMITS.descriptionMax} onChange={(event) => onChange({ ...value, description: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price" htmlFor="promo-price" error={error?.startsWith('priceCents') ? error : undefined}>
          <PriceInput id="promo-price" value={value.priceCents} currency={restaurant.currency} onChange={(cents) => onChange({ ...value, priceCents: cents })} />
        </Field>
        <Field label="Old price" htmlFor="promo-old-price" hint="Shown struck through.">
          <PriceInput id="promo-old-price" value={value.oldPriceCents} currency={restaurant.currency} placeholder="—" onChange={(cents) => onChange({ ...value, oldPriceCents: Number.isFinite(cents) ? cents : undefined })} />
        </Field>
      </div>
      <Field label="Menu item" hint="Optional: the guest can jump to it from the promotion.">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm">{linked ? text(linked.name, restaurant.defaultLocale) : <span className="text-muted">None</span>}</span>
          {value.menuItemId ? (
            <Button size="sm" onClick={() => onChange({ ...value, menuItemId: undefined })}>
              Unlink
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setPicking(true)}>
            {value.menuItemId ? 'Change' : 'Pick from menu'}
          </Button>
        </div>
      </Field>
      {error && !error.startsWith('headline') && !error.startsWith('priceCents') ? <p className="text-xs text-danger-text">{error}</p> : null}
      <MenuItemPicker open={picking} onClose={() => setPicking(false)} onPick={([item]) => item && onChange({ ...value, menuItemId: item.id })} title="Pick the item on offer" />
    </div>
  );
}
