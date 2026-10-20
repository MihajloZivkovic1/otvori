import type { PublicMenuCategoryDto, PublicMenuItemDto } from '@qr-menu/shared';
import type { UiLocale } from './i18n';

const INTL_LOCALE: Record<UiLocale, string> = { sr: 'sr-Latn-RS', en: 'en-GB' };
const NBSP = ' ';
function currencyFormatter(locale: UiLocale, currency: string, fractionDigits: 0 | 2): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return null; // not a well-formed currency code (restaurants may type "dinara"): fall back to "<number> <currency>"
  }
}

/**
 * Price in minor units → "290 RSD", "1.290,50 RSD" (sr) / "1,290.50 RSD" (en). The amount always comes first and
 * the currency last, whatever the locale's default currency pattern is.
 */
export function formatPrice(cents: number, currency: string, locale: UiLocale): string {
  const amount = cents / 100;
  const fractionDigits: 0 | 2 = Number.isInteger(amount) ? 0 : 2;
  const formatter = currencyFormatter(locale, currency, fractionDigits);
  if (!formatter) {
    const number = new Intl.NumberFormat(INTL_LOCALE[locale], {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
    return `${number}${NBSP}${currency}`;
  }
  const parts = formatter.formatToParts(amount);
  const intlSymbol = parts.find((part) => part.type === 'currency')?.value;
  // Intl echoes unknown-but-well-formed codes upper-cased ("din" → "DIN"); keep the restaurant's spelling then.
  const symbol = !intlSymbol || intlSymbol.toUpperCase() === currency.toUpperCase() ? currency : intlSymbol;
  const number = parts
    .filter((part) => part.type !== 'currency' && part.type !== 'literal')
    .map((part) => part.value)
    .join('');
  return `${number}${NBSP}${symbol}`;
}

/** Items with variants are priced "from" their cheapest variant. */
export function lowestPriceCents(item: Pick<PublicMenuItemDto, 'priceCents' | 'variants'>): number {
  if (item.variants.length === 0) return item.priceCents;
  return Math.min(...item.variants.map((variant) => variant.priceCents));
}

export function priceLabel(
  item: Pick<PublicMenuItemDto, 'priceCents' | 'variants'>,
  currency: string,
  locale: UiLocale,
  fromWord: string,
): string {
  const price = formatPrice(lowestPriceCents(item), currency, locale);
  return item.variants.length > 0 ? `${fromWord} ${price}` : price;
}

/** Case- and diacritic-insensitive key: "Ćevapi" → "cevapi", "Đuveč" → "duvec". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

export function filterCategories(categories: PublicMenuCategoryDto[], query: string): PublicMenuCategoryDto[] {
  const needle = normalizeForSearch(query);
  if (!needle) return categories;
  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          normalizeForSearch(item.name).includes(needle) ||
          (item.description !== null && normalizeForSearch(item.description).includes(needle)),
      ),
    }))
    .filter((category) => category.items.length > 0);
}

export function findItem(categories: PublicMenuCategoryDto[], itemId: string): PublicMenuItemDto | null {
  for (const category of categories) {
    const item = category.items.find((candidate) => candidate.id === itemId);
    if (item) return item;
  }
  return null;
}
