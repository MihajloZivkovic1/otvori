import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  LOCALES,
  MODULES,
  updateRestaurantSchema,
  type ModuleKey,
  type RestaurantDto,
  type RestaurantModules,
  type UpdateRestaurantInput,
} from '@qr-menu/shared';
import { DeleteVenueModal } from '../components/settings/DeleteVenueModal';
import { OrderingCard } from '../components/settings/OrderingCard';
import { PaymentCard } from '../components/settings/PaymentCard';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { useUpdateRestaurant } from '../lib/queries';

type SettingsInput = z.input<typeof updateRestaurantSchema>;

const LANGUAGE_LABELS: Record<string, string> = { sr: 'Serbian (SR)', en: 'English (EN)' };

function defaultsOf(restaurant: RestaurantDto): SettingsInput {
  return {
    address: restaurant.address ?? '',
    city: restaurant.city ?? '',
    currency: restaurant.currency,
    defaultLocale: (LOCALES as readonly string[]).includes(restaurant.defaultLocale) ? (restaurant.defaultLocale as SettingsInput['defaultLocale']) : 'sr',
    tagline: restaurant.tagline ?? '',
    menuNote: restaurant.menuNote ?? '',
  };
}

const MODULE_LABELS: Record<ModuleKey, string> = { ordering: 'Ordering', payments: 'Online payment', pos: 'POS integration' };

/** Settings → "Modules" entry: which modules are on, and the link to the page where they are switched. */
function ModulesCard({ restaurantId, modules, isMobile }: { restaurantId: string; modules: RestaurantModules; isMobile: boolean }) {
  const on = MODULES.filter((key) => modules[key]).map((key) => MODULE_LABELS[key]);
  return (
    <section
      aria-labelledby="modules-title"
      className={cn('flex items-center justify-between gap-4 bg-surface p-5', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}
    >
      <div className="flex flex-col gap-1">
        <h2 id="modules-title" className="text-base font-semibold">
          Modules
        </h2>
        <p className="text-[13px] text-muted text-pretty">
          {on.length === 0 ? 'Plain QR menu — no ordering, payment or POS. ' : `On: ${on.join(', ')}. `}
          Switch on only what the venue uses.
        </p>
      </div>
      <Link to={`/r/${restaurantId}/settings/modules`} className="shrink-0 text-sm font-medium text-accent no-underline">
        Manage
      </Link>
    </section>
  );
}

export function SettingsPage() {
  const { restaurant, isOwner, isMobile, hasModule } = useRestaurantContext();
  const { refreshMe } = useAuth();
  const toast = useToast();
  const update = useUpdateRestaurant(restaurant.id);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<SettingsInput, unknown, UpdateRestaurantInput>({
    resolver: zodResolver(updateRestaurantSchema),
    defaultValues: defaultsOf(restaurant),
  });

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(defaultsOf(restaurant));
  }, [restaurant, form]);

  const save = form.handleSubmit(async (input) => {
    try {
      const saved = await update.mutateAsync(input);
      form.reset(defaultsOf(saved));
      void refreshMe();
      toast.success('Settings saved');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const errors = form.formState.errors;
  const controlSize = isMobile ? 'lg' : 'md';
  const supported = LOCALES.filter((l) => restaurant.supportedLocales.includes(l));

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-4 pb-8' : 'max-w-[640px] gap-6 p-6')}>
      {isMobile ? (
        <MobileHeader
          title="Settings"
          backTo={`/r/${restaurant.id}/more`}
          action={
            isOwner ? (
              <Button variant="accent-text" className="h-11 px-2" onClick={() => void save()} loading={update.isPending} disabled={!form.formState.isDirty}>
                Save
              </Button>
            ) : null
          }
        />
      ) : (
        <PageHeader title="Settings" subtitle="Venue details and menu defaults." />
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className={cn('grid gap-4 bg-surface', isMobile ? 'grid-cols-1 border-y border-line px-5 py-5' : 'grid-cols-2 rounded-[10px] border border-line p-5')}
      >
        <fieldset disabled={!isOwner} className="contents">
          <Field label="Address" htmlFor="s-address" className={isMobile ? '' : 'col-span-full'} error={errors.address?.message}>
            <Input id="s-address" controlSize={controlSize} autoComplete="street-address" maxLength={200} invalid={Boolean(errors.address)} {...form.register('address')} />
          </Field>
          <Field label="City" htmlFor="s-city" error={errors.city?.message}>
            <Input id="s-city" controlSize={controlSize} autoComplete="address-level2" maxLength={100} invalid={Boolean(errors.city)} {...form.register('city')} />
          </Field>
          <Field label="Currency" htmlFor="s-currency" hint="Shown after every price, e.g. 290 RSD." error={errors.currency?.message}>
            <Input id="s-currency" controlSize={controlSize} maxLength={8} className="uppercase" invalid={Boolean(errors.currency)} {...form.register('currency')} />
          </Field>
          <Field label="Default language" htmlFor="s-locale" hint="Guests see this language first." error={errors.defaultLocale?.message}>
            <Select id="s-locale" controlSize={controlSize} invalid={Boolean(errors.defaultLocale)} {...form.register('defaultLocale')}>
              {supported.map((locale) => (
                <option key={locale} value={locale}>
                  {LANGUAGE_LABELS[locale] ?? locale.toUpperCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tagline" htmlFor="s-tagline" hint="One line under the name, e.g. “Specialty coffee & breakfast”." error={errors.tagline?.message}>
            <Input id="s-tagline" controlSize={controlSize} maxLength={160} invalid={Boolean(errors.tagline)} {...form.register('tagline')} />
          </Field>
          <Field label="Menu note shown under the name" htmlFor="s-note" className={isMobile ? '' : 'col-span-full'} hint="Opening hours, kitchen times, Wi-Fi…" error={errors.menuNote?.message}>
            <Input id="s-note" controlSize={controlSize} maxLength={500} invalid={Boolean(errors.menuNote)} {...form.register('menuNote')} />
          </Field>
        </fieldset>
        {isMobile ? null : (
          <div className="col-span-full flex items-center gap-2 border-t border-line pt-4">
            <Button type="submit" variant="primary" loading={update.isPending} disabled={!isOwner || !form.formState.isDirty}>
              Save changes
            </Button>
            <Button onClick={() => form.reset(defaultsOf(restaurant))} disabled={!form.formState.isDirty}>
              Reset
            </Button>
            {!isOwner ? <span className="text-xs text-muted">Only owners can change settings.</span> : null}
          </div>
        )}
      </form>

      <section className={cn('flex flex-col gap-1 text-[13px] text-muted', isMobile ? 'px-5' : '')} aria-label="Venue details">
        <div>
          Menu address: <span className="text-ink">{restaurant.publicUrl.replace(/^https?:\/\//, '')}</span>
        </div>
        <div>
          Plan: <span className="capitalize text-ink">{restaurant.plan}</span>
          {restaurant.trialEndsAt ? <> · trial ends {new Date(restaurant.trialEndsAt).toLocaleDateString('en-GB')}</> : null}
          {' · '}
          Time zone: <span className="text-ink">{restaurant.timezone}</span>
        </div>
      </section>

      <ModulesCard restaurantId={restaurant.id} modules={restaurant.modules} isMobile={isMobile} />

      {isOwner && hasModule('ordering') ? <OrderingCard /> : null}

      {isOwner && hasModule('payments') ? <PaymentCard /> : null}

      {isOwner ? (
        <div className={cn('flex items-center justify-between gap-4 rounded-[10px] border border-danger-line bg-surface p-5', isMobile && 'mx-4')}>
          <div>
            <div className="text-sm font-medium">Delete this venue</div>
            <div className="text-[13px] text-muted">Removes the menu, tables and QR codes. Cannot be undone.</div>
          </div>
          <Button variant="danger" className="shrink-0" onClick={() => setDeleting(true)}>
            Delete venue
          </Button>
        </div>
      ) : null}
      {deleting ? <DeleteVenueModal onClose={() => setDeleting(false)} /> : null}
    </div>
  );
}
