import type { Locale } from './constants.js';

/** JSONB column shape for translatable text: `{ "sr": "...", "en": "..." }`. */
export type TranslatedText = Partial<Record<Locale, string>>;

/**
 * Resolve a translatable JSONB value to a plain string for the requested locale.
 * Falls back to `fallbackLocale`, then to any non-empty translation, then to ''.
 */
export function resolveText(
  text: Partial<Record<string, string | null | undefined>> | null | undefined,
  locale: string,
  fallbackLocale: string,
): string {
  if (!text) return '';
  const direct = text[locale]?.trim();
  if (direct) return direct;
  const fallback = text[fallbackLocale]?.trim();
  if (fallback) return fallback;
  for (const value of Object.values(text)) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** Pick the locale to serve: the requested one if supported, otherwise the restaurant default. */
export function pickLocale(
  requested: string | undefined,
  supportedLocales: readonly string[],
  defaultLocale: string,
): string {
  if (requested && supportedLocales.includes(requested)) return requested;
  return defaultLocale;
}
