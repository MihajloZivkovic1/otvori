import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { hexColorSchema, lightHexColorSchema, themeSchema, type RestaurantDto } from '@qr-menu/shared';
import { PhonePreview } from '../components/branding/PhonePreview';
import { LogoTile } from '../components/LogoTile';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { useCategories, useItems, useUpdateRestaurant, useUploadLogo } from '../lib/queries';

/** Subset of the shared update schema edited here (same field schemas, so the API accepts it verbatim). */
const brandingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  primaryColor: hexColorSchema,
  backgroundColor: lightHexColorSchema,
  theme: themeSchema,
});
type BrandingValues = z.infer<typeof brandingSchema>;

const SWATCHES = ['#7A3E48', '#B5421F', '#2F5D50', '#8A5A2B', '#3B5BA5', '#18181B'];
/** Light-appearance page backgrounds: the design's cream first, then pure white and a few quiet neutrals. */
const BACKGROUND_SWATCHES = [
  { hex: '#F7F2EB', label: 'Cream (default)' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#FBF8F1', label: 'Ivory' },
  { hex: '#F3F2EF', label: 'Stone' },
  { hex: '#EEF1F4', label: 'Mist' },
];
const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Match device' },
] as const;

function defaultsOf(restaurant: RestaurantDto): BrandingValues {
  return {
    name: restaurant.name,
    primaryColor: restaurant.primaryColor.toUpperCase(),
    backgroundColor: restaurant.backgroundColor.toUpperCase(),
    theme: restaurant.theme,
  };
}

export function BrandingPage() {
  const { restaurant, isOwner, isMobile } = useRestaurantContext();
  const { refreshMe } = useAuth();
  const toast = useToast();
  const update = useUpdateRestaurant(restaurant.id);
  const uploadLogo = useUploadLogo(restaurant.id);
  const categories = useCategories(restaurant.id);
  const items = useItems(restaurant.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const form = useForm<BrandingValues>({ resolver: zodResolver(brandingSchema), defaultValues: defaultsOf(restaurant) });
  const values = form.watch();

  // Another tab/user may change branding; follow the saved state while the form is untouched.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(defaultsOf(restaurant));
  }, [restaurant, form]);

  const save = form.handleSubmit(async (input) => {
    try {
      const saved = await update.mutateAsync({
        ...input,
        primaryColor: input.primaryColor.toUpperCase(),
        backgroundColor: input.backgroundColor.toUpperCase(),
      });
      form.reset(defaultsOf(saved));
      void refreshMe();
      toast.success('Branding saved');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    uploadLogo.mutate(file, {
      onSuccess: () => {
        void refreshMe();
        toast.success('Logo updated');
      },
      onError: (error) => toast.error(errorMessage(error, 'Could not upload the logo')),
    });
  };

  const preview = (
    <PhonePreview
      variant={isMobile ? 'card' : 'phone'}
      name={values.name}
      color={values.primaryColor}
      background={values.backgroundColor}
      theme={values.theme}
      logoUrl={restaurant.logoUrl}
      categories={categories.data ?? []}
      items={items.data ?? []}
      currency={restaurant.currency}
      defaultLocale={restaurant.defaultLocale}
    />
  );

  const colorField = (
    <Controller
      control={form.control}
      name="primaryColor"
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-2">
          <span className={cn('font-medium', isMobile ? 'text-[15px]' : 'text-[13px]')}>Primary color</span>
          <div className={cn('flex flex-wrap items-center', isMobile ? 'gap-2.5' : 'gap-2')} role="radiogroup" aria-label="Primary color">
            {SWATCHES.map((hex) => {
              const selected = field.value.toUpperCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={hex}
                  title={hex}
                  disabled={!isOwner}
                  onClick={() => field.onChange(hex)}
                  className={cn('cursor-pointer rounded-full border-none disabled:cursor-default', isMobile ? 'size-10' : 'size-8')}
                  style={{ background: hex, boxShadow: selected ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'inset 0 0 0 1px var(--swatch-ring)' }}
                />
              );
            })}
            <Input
              aria-label="Primary color hex"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              disabled={!isOwner}
              invalid={Boolean(fieldState.error)}
              maxLength={7}
              spellCheck={false}
              className={cn('font-mono font-medium', isMobile ? 'h-10 min-w-[90px] flex-1 rounded-[10px] text-sm' : 'ml-2 h-8 w-[110px] text-[13px]')}
            />
          </div>
          {fieldState.error ? (
            <span role="alert" className="text-xs text-danger-text">
              {fieldState.error.message}
            </span>
          ) : (
            <span className="text-xs text-faint">Used for the logo tile, active category and tags. Text stays neutral for readability.</span>
          )}
        </div>
      )}
    />
  );

  const backgroundField = (
    <Controller
      control={form.control}
      name="backgroundColor"
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-2">
          <span className={cn('font-medium', isMobile ? 'text-[15px]' : 'text-[13px]')}>Background color</span>
          <div className={cn('flex flex-wrap items-center', isMobile ? 'gap-2.5' : 'gap-2')} role="radiogroup" aria-label="Background color">
            {BACKGROUND_SWATCHES.map(({ hex, label }) => {
              const selected = field.value.toUpperCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  title={`${label} · ${hex}`}
                  disabled={!isOwner}
                  onClick={() => field.onChange(hex)}
                  className={cn('cursor-pointer rounded-full border-none disabled:cursor-default', isMobile ? 'size-10' : 'size-8')}
                  style={{ background: hex, boxShadow: selected ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'inset 0 0 0 1px var(--swatch-ring)' }}
                />
              );
            })}
            <Input
              aria-label="Background color hex"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              disabled={!isOwner}
              invalid={Boolean(fieldState.error)}
              maxLength={7}
              spellCheck={false}
              className={cn('font-mono font-medium', isMobile ? 'h-10 min-w-[90px] flex-1 rounded-[10px] text-sm' : 'ml-2 h-8 w-[110px] text-[13px]')}
            />
          </div>
          {fieldState.error ? (
            <span role="alert" className="text-xs text-danger-text">
              {fieldState.error.message}
            </span>
          ) : (
            <span className="text-xs text-faint">Page background of the light appearance. Dark keeps its own palette.</span>
          )}
        </div>
      )}
    />
  );

  const logoInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/svg+xml,image/jpeg,image/webp"
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        onLogoFile(event.target.files?.[0]);
        event.target.value = '';
      }}
    />
  );

  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col">
        <MobileHeader
          title="Branding"
          backTo={`/r/${restaurant.id}/more`}
          action={
            isOwner ? (
              <Button variant="accent-text" className="h-11 px-2" onClick={() => void save()} loading={update.isPending} disabled={!form.formState.isDirty}>
                Save
              </Button>
            ) : null
          }
        />
        <form className="flex flex-col gap-5 px-5 pb-6 pt-2" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="flex items-center gap-3.5">
            <LogoTile name={values.name} color={values.primaryColor} logoUrl={restaurant.logoUrl} size={64} radius={14} />
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[15px] font-medium">Logo</span>
              <span className="text-xs text-muted">Square PNG or SVG</span>
            </div>
            {isOwner ? (
              <Button size="lg" className="rounded-[10px]" loading={uploadLogo.isPending} onClick={() => fileRef.current?.click()}>
                {restaurant.logoUrl ? 'Replace' : 'Upload'}
              </Button>
            ) : null}
          </div>
          {logoInput}
          <Field label={<span className="text-[15px]">Restaurant name</span>} htmlFor="brand-name" error={form.formState.errors.name?.message}>
            <Input id="brand-name" controlSize="lg" disabled={!isOwner} invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          </Field>
          {colorField}
          {backgroundField}
          <Controller
            control={form.control}
            name="theme"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <span className="text-[15px] font-medium">Default appearance</span>
                <Segmented label="Default appearance" options={THEME_OPTIONS} value={field.value} onChange={field.onChange} className="w-fit" />
              </div>
            )}
          />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Live preview</span>
            {preview}
          </div>
          {!isOwner ? <p className="text-xs text-muted">Only owners can change branding.</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-10 p-6">
      <form className="flex min-w-[320px] max-w-[520px] flex-1 flex-col gap-7" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <PageHeader title="Branding" subtitle="What guests see when they scan. Changes preview live on the right." />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Logo</span>
          <div className="flex items-center gap-4">
            <LogoTile name={values.name} color={values.primaryColor} logoUrl={restaurant.logoUrl} size={72} radius={14} />
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                onLogoFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                'flex h-[72px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[13px] text-muted transition-colors disabled:cursor-default',
                dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-line-2',
              )}
            >
              {uploadLogo.isPending ? (
                'Uploading…'
              ) : (
                <>
                  Drop a PNG or SVG, or <span className="font-medium text-accent">browse</span>
                </>
              )}
            </button>
          </div>
          {logoInput}
          <span className="text-xs text-faint">Square, at least 256 × 256. Shown at 44px on phones.</span>
        </div>
        <Field label="Restaurant name" htmlFor="brand-name" error={form.formState.errors.name?.message}>
          <Input id="brand-name" disabled={!isOwner} invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
        </Field>
        {colorField}
        {backgroundField}
        <Controller
          control={form.control}
          name="theme"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Default appearance</span>
              <Segmented label="Default appearance" options={THEME_OPTIONS} value={field.value} onChange={field.onChange} className="w-fit" />
            </div>
          )}
        />
        <div className="flex gap-2 border-t border-line pt-2">
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!isOwner || !form.formState.isDirty}>
            Save changes
          </Button>
          <Button onClick={() => form.reset(defaultsOf(restaurant))} disabled={!form.formState.isDirty}>
            Reset
          </Button>
          {!isOwner ? <span className="self-center text-xs text-muted">Only owners can change branding.</span> : null}
        </div>
      </form>
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Live preview · Table 7</span>
        {preview}
      </div>
    </div>
  );
}
