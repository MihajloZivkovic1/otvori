import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { Locale } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import type { ItemFormValues } from './useItemForm';
import { PriceInput } from './PriceInput';

interface VariantsTableProps {
  form: UseFormReturn<ItemFormValues>;
  currency: string;
  layout: 'drawer' | 'sheet';
  /** The default locale: the heading is typed in that language here (other languages on their own tab). */
  lang: Locale;
}

/** Suggestions for the group heading; the empty one means the menu app's default "Size". */
export const VARIANT_LABEL_PRESETS: Record<Locale, string[]> = {
  sr: ['Vrsta', 'Ukus', 'Vrsta kafe', 'Porcija'],
  en: ['Type', 'Flavour', 'Coffee blend', 'Portion'],
};

/** Size/portion variants with replace-all semantics; the item's base price is "from" the cheapest variant. */
export function VariantsTable({ form, currency, layout, lang }: VariantsTableProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });
  const errors = form.formState.errors.variants;
  const large = layout === 'sheet';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={cn('font-medium', large ? 'text-[13px]' : 'text-[13px]')}>Variants</span>
        <Button size="sm" className={large ? 'h-8 rounded-lg text-[13px]' : 'h-7 rounded-md text-xs'} onClick={() => append({ name: '', priceCents: Number.NaN })}>
          {large ? '+ Add' : '+ Add variant'}
        </Button>
      </div>
      <div className={cn('overflow-hidden border border-line', large ? 'rounded-[10px]' : 'rounded-lg')}>
        {!large ? (
          <div className="grid grid-cols-[1fr_110px_32px] gap-2 border-b border-line bg-canvas px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
            <span>Name</span>
            <span>Price</span>
            <span />
          </div>
        ) : null}
        {fields.map((field, index) => {
          const rowErrors = errors?.[index];
          return (
            <div
              key={field.id}
              className={cn(
                'grid items-center gap-2 border-b border-line-2 last:border-b-0',
                large ? 'grid-cols-[1fr_96px_36px] py-1.5 pl-2 pr-1.5' : 'grid-cols-[1fr_110px_32px] px-2.5 py-1.5',
              )}
            >
              <input
                type="text"
                placeholder={index === 0 ? 'Small 180 ml' : 'Large 300 ml'}
                aria-label={`Variant ${index + 1} name`}
                aria-invalid={rowErrors?.name ? true : undefined}
                className={cn(
                  'min-w-0 rounded-md border bg-transparent text-ink placeholder:text-faint focus:border-line focus:bg-surface',
                  large ? 'h-10 px-3 text-[15px]' : 'h-8 px-2.5 text-[13px]',
                  rowErrors?.name ? 'border-danger' : 'border-transparent',
                )}
                {...form.register(`variants.${index}.name` as const)}
              />
              <Controller
                control={form.control}
                name={`variants.${index}.priceCents` as const}
                render={({ field: priceField, fieldState }) => (
                  <PriceInput
                    variant="bare"
                    value={priceField.value}
                    onChange={priceField.onChange}
                    onBlur={priceField.onBlur}
                    currency={currency}
                    invalid={Boolean(fieldState.error)}
                    aria-label={`Variant ${index + 1} price`}
                  />
                )}
              />
              <button
                type="button"
                aria-label={`Remove variant ${index + 1}`}
                onClick={() => remove(index)}
                className={cn('grid cursor-pointer place-items-center rounded-md text-faint hover:bg-line-2 hover:text-ink', large ? 'size-9' : 'size-7')}
              >
                <Icon name="close" size={14} strokeWidth={1.8} />
              </button>
            </div>
          );
        })}
        {fields.length === 0 ? (
          <div className="p-3 text-center text-[13px] text-faint">Single size. Add a variant for Small / Large.</div>
        ) : null}
      </div>
      {typeof errors?.message === 'string' ? <span className="text-xs text-danger-text">{errors.message}</span> : null}
      {fields.length > 0 ? <VariantLabelField form={form} lang={lang} large={large} /> : null}
    </div>
  );
}

/**
 * What the group of variants is called on the guest's screen: "Size" by default, or the venue's own word
 * ("Vrsta kafe" for coffee blends, "Ukus" for flavours). Stored per language like a description.
 */
export function VariantLabelField({ form, lang, large }: { form: UseFormReturn<ItemFormValues>; lang: Locale; large: boolean }) {
  const id = `item-variant-label-${lang}`;
  const value = form.watch(`variantLabel.${lang}` as const) ?? '';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        Variants heading{lang === 'en' ? ' (English)' : ''}
      </label>
      <input
        id={id}
        type="text"
        maxLength={500}
        placeholder={lang === 'en' ? 'Size' : 'Veličina'}
        className={cn(
          'rounded-md border border-line bg-surface text-ink placeholder:text-faint focus:border-line-strong',
          large ? 'h-11 px-3 text-[15px]' : 'h-9 px-2.5 text-[13px]',
        )}
        {...form.register(`variantLabel.${lang}` as const)}
      />
      <div className="flex flex-wrap gap-1.5">
        {VARIANT_LABEL_PRESETS[lang].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => form.setValue(`variantLabel.${lang}` as const, value === preset ? '' : preset, { shouldDirty: true })}
            className={cn(
              'h-7 cursor-pointer rounded-full border px-2.5 text-xs',
              value === preset ? 'border-ink bg-ink text-surface' : 'border-line text-ink-2 hover:bg-line-2',
            )}
          >
            {preset}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted">Shown above the variant list. Empty = “{lang === 'en' ? 'Size' : 'Veličina'}”.</span>
    </div>
  );
}
