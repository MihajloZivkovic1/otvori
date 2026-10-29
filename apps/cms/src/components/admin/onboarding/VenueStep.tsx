import { useState, type FormEvent } from 'react';
import { LOCALES, superadminCreateRestaurantSchema, type SuperadminCreateRestaurantInput, type SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useDebounced } from '../../../hooks/useDebounced';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useSlugCheck } from '../../../lib/admin';
import { cn } from '../../../lib/cn';
import { slugify } from '../../../lib/slug';
import { Icon } from '../../icons';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/Field';

const LANGUAGE: Record<string, string> = { sr: 'Serbian (SR)', en: 'English (EN)' };
const FALLBACK_ZONES = ['Europe/Belgrade', 'Europe/Podgorica', 'Europe/Sarajevo', 'Europe/Zagreb', 'Europe/Skopje', 'Europe/Ljubljana', 'Europe/Vienna', 'Europe/Berlin', 'Europe/London', 'UTC'];

function timeZones(): string[] {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone');
    return all && all.length ? all : FALLBACK_ZONES;
  } catch {
    return FALLBACK_ZONES;
  }
}

interface VenueStepProps {
  /** Editing an existing venue (resume) or creating a new one. */
  venue: SuperadminRestaurantDetailDto | null;
  loading?: boolean;
  error?: string | null;
  onSubmit: (input: SuperadminCreateRestaurantInput) => void;
}

/** Step 1: the venue itself; the slug follows the name until edited and is checked live. */
export function VenueStep({ venue, loading, error, onSubmit }: VenueStepProps) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(venue?.name ?? '');
  const [slug, setSlug] = useState(venue?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(venue));
  const [city, setCity] = useState(venue?.city ?? '');
  const [address, setAddress] = useState(venue?.address ?? '');
  const [timezone, setTimezone] = useState(venue?.timezone ?? 'Europe/Belgrade');
  const [currency, setCurrency] = useState(venue?.currency ?? 'RSD');
  const [defaultLocale, setDefaultLocale] = useState<string>(venue?.defaultLocale ?? 'sr');
  const [supported, setSupported] = useState<string[]>(venue?.supportedLocales ?? ['sr', 'en']);
  const [tagline, setTagline] = useState(venue?.tagline ?? '');
  const [menuNote, setMenuNote] = useState(venue?.menuNote ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const effectiveSlug = slugTouched ? slug : slugify(name);
  const debouncedSlug = useDebounced(effectiveSlug, 350);
  const check = useSlugCheck(debouncedSlug, venue?.id, debouncedSlug.length >= 3);
  const zones = timeZones();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const candidate = {
      name: name.trim(),
      slug: effectiveSlug,
      city: city.trim() || null,
      address: address.trim() || null,
      timezone,
      currency: currency.trim().toUpperCase(),
      defaultLocale,
      supportedLocales: supported,
      tagline: tagline.trim() || null,
      menuNote: menuNote.trim() || null,
    };
    const parsed = superadminCreateRestaurantSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    if (check.data && !check.data.available && check.data.slug === effectiveSlug) {
      setErrors({ slug: check.data.reason === 'taken' ? 'This address is taken' : check.data.reason === 'reserved' ? 'This address is reserved' : 'Use lowercase letters, digits and hyphens' });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const toggleLocale = (locale: string) => {
    const next = supported.includes(locale) ? supported.filter((l) => l !== locale) : [...supported, locale];
    if (next.length === 0) return;
    setSupported(next);
    if (!next.includes(defaultLocale)) setDefaultLocale(next[0]!);
  };

  const slugState = effectiveSlug.length < 3 ? null : check.isPending || debouncedSlug !== effectiveSlug ? 'checking' : check.data?.available ? 'free' : check.data ? 'taken' : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Venue">
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <Field label="Venue name" htmlFor="v-name" error={errors.name} className="col-span-full">
          <Input id="v-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="organization" invalid={Boolean(errors.name)} data-autofocus placeholder="Kafeterija Dorćol" />
        </Field>
        <Field
          label="Menu address"
          htmlFor="v-slug"
          error={errors.slug}
          hint={
            slugState === 'checking' ? 'Checking…' : slugState === 'free' ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Icon name="check" size={11} strokeWidth={2.4} /> {effectiveSlug}.otvori.menu is free
              </span>
            ) : slugState === 'taken' ? (
              <span className="text-danger-text">
                {check.data?.reason === 'reserved' ? 'Reserved' : check.data?.reason === 'invalid' ? 'Lowercase letters, digits and hyphens only' : 'Taken'} — try {check.data?.suggestion}
              </span>
            ) : (
              'Lowercase letters, digits and hyphens; becomes {slug}.otvori.menu.'
            )
          }
          trailing={
            slugState === 'taken' && check.data?.suggestion ? (
              <button
                type="button"
                onClick={() => {
                  setSlug(check.data!.suggestion);
                  setSlugTouched(true);
                }}
                className="cursor-pointer text-[13px] font-medium text-accent"
              >
                Use {check.data.suggestion}
              </button>
            ) : null
          }
          className="col-span-full"
        >
          <Input
            id="v-slug"
            value={effectiveSlug}
            onChange={(event) => {
              setSlug(event.target.value.toLowerCase());
              setSlugTouched(true);
            }}
            maxLength={63}
            autoComplete="off"
            spellCheck={false}
            invalid={Boolean(errors.slug) || slugState === 'taken'}
            className="font-mono"
          />
        </Field>
        <Field label="City" htmlFor="v-city" error={errors.city}>
          <Input id="v-city" value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} autoComplete="address-level2" />
        </Field>
        <Field label="Address" htmlFor="v-address" error={errors.address}>
          <Input id="v-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={200} autoComplete="street-address" />
        </Field>
        <Field label="Time zone" htmlFor="v-tz" error={errors.timezone}>
          <Select id="v-tz" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {!zones.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="v-currency" error={errors.currency} hint="Shown after every price, e.g. 290 RSD.">
          <Input id="v-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={8} className="uppercase" />
        </Field>
        <fieldset className="flex flex-col gap-1.5 border-0 p-0">
          <legend className="text-[13px] font-medium">Languages</legend>
          <div className="flex gap-3">
            {LOCALES.map((locale) => (
              <label key={locale} className="inline-flex h-10 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={supported.includes(locale)} onChange={() => toggleLocale(locale)} className="size-4 accent-[var(--accent)]" />
                {LANGUAGE[locale]}
              </label>
            ))}
          </div>
          {errors.supportedLocales ? <span className="text-xs text-danger-text">{errors.supportedLocales}</span> : null}
        </fieldset>
        <Field label="Default language" htmlFor="v-locale" hint="Guests see this one first." error={errors.defaultLocale}>
          <Select id="v-locale" value={defaultLocale} onChange={(event) => setDefaultLocale(event.target.value)}>
            {supported.map((locale) => (
              <option key={locale} value={locale}>
                {LANGUAGE[locale] ?? locale}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tagline" htmlFor="v-tagline" error={errors.tagline} hint="One line under the name.">
          <Input id="v-tagline" value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={160} placeholder="Specialty coffee & breakfast" />
        </Field>
        <Field label="Menu note" htmlFor="v-note" error={errors.menuNote} hint="Opening hours, kitchen times, Wi-Fi…">
          <Input id="v-note" value={menuNote} onChange={(event) => setMenuNote(event.target.value)} maxLength={500} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-danger-text">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size={isMobile ? 'lg' : 'md'} loading={loading} disabled={slugState === 'checking'}>
          {venue ? 'Save and continue' : 'Create venue and continue'}
        </Button>
      </div>
    </form>
  );
}
