import { en } from './en';
import { sr } from './sr';
import type { Dictionary, Locale } from './types';

export type { Dictionary, Locale } from './types';

export const locales: readonly Locale[] = ['sr', 'en'];
export const defaultLocale: Locale = 'sr';

const dictionaries: Record<Locale, Dictionary> = { sr, en };

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Path of the landing page in a locale: "/" for Serbian (default), "/en/" for English. */
export function localePath(locale: Locale): string {
  return locale === defaultLocale ? '/' : `/${locale}/`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'sr' ? 'en' : 'sr';
}

/** Number formatting shared by the page and the pricing script: "1.490" in both locales (design uses sr-RS grouping). */
export function formatRsd(amount: number): string {
  return new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(amount);
}
