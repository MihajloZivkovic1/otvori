import { Controller } from 'react-hook-form';
import { ALLERGENS, TAGS, type Locale } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Chip } from '../ui/Chip';
import { Field, Input, Textarea } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { ALLERGEN_LABELS, TAG_LABELS } from './labels';
import { PhotoField } from './PhotoField';
import { PriceInput, priceError } from './PriceInput';
import type { ItemEditor } from './useItemForm';
import { VariantLabelField, VariantsTable } from './VariantsTable';

interface ItemFieldsProps {
  editor: ItemEditor;
  /** Language tab being edited. */
  lang: Locale;
  /** The restaurant's default locale: its tab carries every shared field. */
  primaryLang: Locale;
  currency: string;
  currentImageUrl: string | null;
  layout: 'drawer' | 'sheet';
}

const LANG_NAMES: Record<Locale, string> = { sr: 'Serbian', en: 'English' };

export function ItemFields({ editor, lang, primaryLang, currency, currentImageUrl, layout }: ItemFieldsProps) {
  const { restaurant, hasModule } = useRestaurantContext();
  const { form } = editor;
  const errors = form.formState.errors;
  const large = layout === 'sheet';
  const controlSize = large ? 'lg' : 'md';
  const secondary = lang !== primaryLang;
  const nameError = typeof errors.name?.message === 'string' ? errors.name.message : undefined;

  const nameField = (
    <Field label={secondary ? `Name (${LANG_NAMES[lang]})` : 'Name'} htmlFor={`item-name-${lang}`} error={nameError}>
      <Input
        id={`item-name-${lang}`}
        controlSize={controlSize}
        invalid={Boolean(nameError)}
        maxLength={500}
        data-autofocus={!large || undefined}
        {...form.register(`name.${lang}` as const)}
      />
    </Field>
  );
  const descriptionField = (
    <Field label={secondary ? `Description (${LANG_NAMES[lang]})` : 'Description'} htmlFor={`item-desc-${lang}`}>
      <Textarea id={`item-desc-${lang}`} rows={large ? 2 : 3} controlSize={controlSize} maxLength={2000} className={large ? 'resize-none' : undefined} {...form.register(`description.${lang}` as const)} />
    </Field>
  );

  if (secondary) {
    return (
      <>
        <div className="rounded-lg bg-line-2 px-3 py-2 text-xs text-ink-2">
          Editing the {LANG_NAMES[lang]} translation. Price, image, variants and allergens are shared across languages.
        </div>
        {nameField}
        {descriptionField}
        {(form.watch('variants') ?? []).length > 0 ? <VariantLabelField form={form} lang={lang} large={large} /> : null}
      </>
    );
  }

  const photo = (
    <PhotoField
      currentUrl={currentImageUrl}
      file={editor.photo}
      onFile={editor.setPhoto}
      zoom={editor.zoom}
      onZoom={editor.setZoom}
      layout={layout}
    />
  );

  const price = (
    <Controller
      control={form.control}
      name="priceCents"
      render={({ field, fieldState }) => (
        <Field label="Price" htmlFor="item-price" error={priceError(fieldState.error?.message)} hint={large ? 'Opens the number pad.' : undefined}>
          <PriceInput
            id="item-price"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            currency={currency}
            controlSize={controlSize}
            invalid={Boolean(fieldState.error)}
          />
        </Field>
      )}
    />
  );

  const availability = (
    <Controller
      control={form.control}
      name="isAvailable"
      render={({ field }) => {
        const checked = field.value ?? true;
        const toggle = (next: boolean) => {
          editor.markAvailabilityTouched();
          field.onChange(next);
          form.setValue('unavailableUntil', null);
        };
        if (large) {
          return (
            <div
              className="flex h-14 cursor-pointer items-center justify-between rounded-xl border border-line bg-surface px-4"
              onClick={() => toggle(!checked)}
            >
              <span className="flex flex-col items-start gap-px">
                <span className="text-[15px] font-medium">Available</span>
                <span className="text-xs text-muted">{checked ? 'Shown to guests' : 'Not available today'}</span>
              </span>
              <Switch size="lg" checked={checked} onChange={toggle} label="Available" />
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Available</span>
            <div
              className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-[13px]"
              onClick={() => toggle(!checked)}
            >
              <Switch size="sm" checked={checked} onChange={toggle} label="Available" />
              {checked ? 'Shown to guests' : 'Not available today'}
            </div>
          </div>
        );
      }}
    />
  );

  const allergens = (
    <Controller
      control={form.control}
      name="allergens"
      render={({ field }) => {
        const selected = field.value ?? [];
        return (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Allergens</span>
            <div className={cn('flex flex-wrap', large ? 'gap-2' : 'gap-1.5')}>
              {ALLERGENS.map((code) => {
                const on = selected.includes(code);
                return (
                  <Chip
                    key={code}
                    selected={on}
                    size={large ? 'lg' : 'md'}
                    glyph={code}
                    onClick={() => field.onChange(on ? selected.filter((c) => c !== code) : [...selected, code])}
                  >
                    {ALLERGEN_LABELS[code]}
                  </Chip>
                );
              })}
            </div>
          </div>
        );
      }}
    />
  );

  // POS product code (Phase 9d): only with the POS module; a warning while the venue sends orders and the code is missing.
  const posCode = hasModule('pos') ? (
    <Controller
      control={form.control}
      name="posProductCode"
      render={({ field }) => {
        const missing = restaurant.posConfig.sendOrdersToPos && !(field.value ?? '').trim();
        return (
          <Field
            label="POS product code"
            htmlFor="item-pos-code"
            hint={missing ? undefined : 'The code of this item on the register (Settings → Integrations → Sync products fills it in).'}
            error={missing ? 'No POS code: guests cannot order this item while orders go to the register.' : undefined}
          >
            <Input
              id="item-pos-code"
              controlSize={controlSize}
              maxLength={64}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.target.value || null)}
              onBlur={field.onBlur}
              invalid={missing}
              placeholder="e.g. ESP"
            />
          </Field>
        );
      }}
    />
  ) : null;

  const tags = (
    <Controller
      control={form.control}
      name="tags"
      render={({ field }) => {
        const selected = field.value ?? [];
        return (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Tags</span>
            <div className={cn('flex flex-wrap', large ? 'gap-2' : 'gap-1.5')}>
              {TAGS.map((tag) => {
                const on = selected.includes(tag);
                return (
                  <Chip
                    key={tag}
                    selected={on}
                    tone="ink"
                    size={large ? 'lg' : 'md'}
                    onClick={() => field.onChange(on ? selected.filter((t) => t !== tag) : [...selected, tag])}
                  >
                    {TAG_LABELS[tag]}
                  </Chip>
                );
              })}
            </div>
          </div>
        );
      }}
    />
  );

  if (large) {
    return (
      <>
        {photo}
        {nameField}
        {descriptionField}
        {price}
        <VariantsTable form={form} currency={currency} layout="sheet" lang={lang} />
        {allergens}
        {tags}
        {posCode}
        {availability}
      </>
    );
  }

  return (
    <>
      {nameField}
      {descriptionField}
      <div className="grid grid-cols-2 gap-3">
        {price}
        {availability}
      </div>
      {photo}
      <VariantsTable form={form} currency={currency} layout="drawer" lang={lang} />
      {allergens}
      {tags}
      {posCode}
    </>
  );
}
