/**
 * UI strings for the guest menu (Serbian Latin + English). Menu *content* is translated server-side;
 * this dictionary only covers chrome: labels, buttons, empty states, tag and allergen names.
 */
export const UI_LOCALES = ['sr', 'en'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export function isUiLocale(value: string): value is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(value);
}

/** Map any resolved locale string to a dictionary we have; unknown locales read the English chrome. */
export function toUiLocale(locale: string): UiLocale {
  return isUiLocale(locale) ? locale : 'en';
}

export interface Dictionary {
  table: string;
  unavailable: string;
  from: string;
  size: string;
  allergens: string;
  noAllergens: string;
  close: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  noResults: string;
  emptyMenu: string;
  switchLanguage: string;
  categories: string;
  loading: string;
  offlineTitle: string;
  offlineBody: string;
  notPublishedBody: string;
  notFoundBody: string;
  retry: string;
  askStaff: string;
  tags: Record<string, string>;
  allergenNames: Record<string, string>;
  itemCount: (count: number) => string;
}

const srPlural = new Intl.PluralRules('sr');

export const dict: Record<UiLocale, Dictionary> = {
  en: {
    table: 'Table',
    unavailable: 'Not available today',
    from: 'from',
    size: 'Size',
    allergens: 'Allergens',
    noAllergens: 'No declared allergens',
    close: 'Close',
    search: 'Search',
    searchPlaceholder: 'Search the menu',
    clearSearch: 'Clear search',
    noResults: 'Nothing on the menu matches your search.',
    emptyMenu: 'The menu is empty for now.',
    switchLanguage: 'Switch language',
    categories: 'Categories',
    loading: 'Loading menu',
    offlineTitle: "The menu couldn't load",
    offlineBody: 'Check your connection and try again. Prices and availability need a live connection.',
    notPublishedBody: "This menu isn't published yet. Please check back in a moment.",
    notFoundBody: "We couldn't find a menu at this address.",
    retry: 'Try again',
    askStaff: 'Or ask our staff for a printed menu.',
    tags: { vegan: 'Vegan', spicy: 'Spicy', new: 'New' },
    allergenNames: { G: 'Gluten', M: 'Milk', E: 'Eggs', N: 'Nuts', S: 'Soy', F: 'Fish', C: 'Celery', Se: 'Sesame' },
    itemCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
  },
  sr: {
    table: 'Sto',
    unavailable: 'Danas nije dostupno',
    from: 'od',
    size: 'Veličina',
    allergens: 'Alergeni',
    noAllergens: 'Bez deklarisanih alergena',
    close: 'Zatvori',
    search: 'Pretraga',
    searchPlaceholder: 'Pretraži meni',
    clearSearch: 'Obriši pretragu',
    noResults: 'Nijedna stavka ne odgovara pretrazi.',
    emptyMenu: 'Meni je trenutno prazan.',
    switchLanguage: 'Promeni jezik',
    categories: 'Kategorije',
    loading: 'Učitavanje menija',
    offlineTitle: 'Meni nije mogao da se učita',
    offlineBody: 'Proverite vezu i pokušajte ponovo. Cene i dostupnost zahtevaju internet.',
    notPublishedBody: 'Ovaj meni još nije objavljen. Pokušajte ponovo malo kasnije.',
    notFoundBody: 'Na ovoj adresi nema menija.',
    retry: 'Pokušaj ponovo',
    askStaff: 'Ili zatražite štampani meni od osoblja.',
    tags: { vegan: 'Vegan', spicy: 'Ljuto', new: 'Novo' },
    allergenNames: { G: 'Gluten', M: 'Mleko', E: 'Jaja', N: 'Orašasti plodovi', S: 'Soja', F: 'Riba', C: 'Celer', Se: 'Susam' },
    itemCount: (count) => {
      const category = srPlural.select(count);
      const noun = category === 'one' ? 'stavka' : category === 'few' ? 'stavke' : 'stavki';
      return `${count} ${noun}`;
    },
  },
};

export function tagLabel(t: Dictionary, tag: string): string {
  return t.tags[tag] ?? tag;
}

export function allergenName(t: Dictionary, code: string): string {
  return t.allergenNames[code] ?? code;
}
