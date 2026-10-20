import type { Locale } from '@qr-menu/shared';
import { LOCALES } from '@qr-menu/shared';
import { Segmented } from '../ui/Segmented';

/** SR/EN segmented control; hidden when the restaurant supports a single language. */
export function LangTabs({ supported, value, onChange }: { supported: string[]; value: Locale; onChange: (lang: Locale) => void }) {
  const options = LOCALES.filter((l) => supported.includes(l)).map((l) => ({ value: l, label: l.toUpperCase() }));
  if (options.length < 2) return null;
  return <Segmented size="sm" label="Language" options={options} value={value} onChange={onChange} />;
}

export function primaryLocale(defaultLocale: string): Locale {
  return (LOCALES as readonly string[]).includes(defaultLocale) ? (defaultLocale as Locale) : 'sr';
}
