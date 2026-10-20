import { LOCALES, RESTAURANT_DEFAULTS, pickLocale, type Locale } from '@qr-menu/shared';
import { isUiLocale, toUiLocale, type UiLocale } from './i18n';

const STORAGE_KEY = 'tabla.lang';

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Locale the guest asked for: ?lang → localStorage → nothing (the restaurant default decides). */
export function requestedLocale(params: URLSearchParams): Locale | undefined {
  const fromQuery = params.get('lang');
  if (fromQuery && isLocale(fromQuery)) return fromQuery;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    // storage unavailable
  }
  return undefined;
}

export function rememberLocale(locale: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

interface LocaleSource {
  supportedLocales: readonly string[];
  defaultLocale: string;
}

/** Locale for UI strings: the restaurant's supported/default locales win once we know them. */
export function resolveUiLocale(requested: string | undefined, restaurant: LocaleSource | null): UiLocale {
  const resolved = restaurant
    ? pickLocale(requested, restaurant.supportedLocales, restaurant.defaultLocale)
    : (requested ?? RESTAURANT_DEFAULTS.defaultLocale);
  return toUiLocale(resolved);
}

/** Locales the switcher offers, in the restaurant's order. */
export function switchableLocales(supported: readonly string[]): UiLocale[] {
  return supported.filter(isUiLocale);
}

export function nextLocale(current: UiLocale, supported: readonly string[]): UiLocale | null {
  const options = switchableLocales(supported);
  if (options.length < 2) return null;
  const index = options.indexOf(current);
  return options[(index + 1) % options.length] ?? null;
}
