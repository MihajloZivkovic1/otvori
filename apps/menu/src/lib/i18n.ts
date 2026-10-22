import type { OrderStatus } from '@qr-menu/shared';

/**
 * UI strings for the guest menu (Serbian Latin + English). Menu *content* is translated server-side;
 * this dictionary only covers chrome: labels, buttons, empty states, tag and allergen names, ordering copy.
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

export interface OrderStatusCopy {
  title: string;
  body: string;
  /** One word for lists ("Delivered"). */
  short: string;
}

export interface OrderingErrors {
  blocked: string;
  paused: string;
  unavailable: string;
  tooMany: string;
  tableNotFound: string;
  disabled: string;
  rateLimited: string;
  cartFull: string;
  network: string;
  generic: string;
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
  // ordering (design/ordering-menu.html)
  yourOrders: string;
  callWaiter: string;
  bill: string;
  called: string;
  waiterNotified: string;
  viewCart: string;
  add: string;
  addToCart: string;
  quantity: string;
  lineNote: string;
  lineNotePlaceholder: string;
  cart: string;
  orderNote: string;
  orderNotePlaceholder: string;
  guestName: string;
  guestNamePlaceholder: string;
  tableNumber: string;
  tableHelp: string;
  tableRequired: string;
  confirm: string;
  total: string;
  send: string;
  sending: string;
  payNote: string;
  added: string;
  paused: string;
  pausedDefault: string;
  menu: string;
  order: string;
  sentAt: string;
  reason: string;
  autoRefresh: string;
  cancelOrder: string;
  confirmCancel: string;
  keepOrder: string;
  backToMenu: string;
  orderAgain: string;
  earlierOrders: string;
  emptyCart: string;
  decrease: string;
  increase: string;
  orderNotFound: string;
  orderNotFoundBody: string;
  steps: readonly [string, string, string];
  status: Record<OrderStatus, OrderStatusCopy>;
  errors: OrderingErrors;
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
    yourOrders: 'Your orders',
    callWaiter: 'Call the waiter',
    bill: 'The bill',
    called: 'Called',
    waiterNotified: 'Waiter notified',
    viewCart: 'View cart',
    add: 'Add',
    addToCart: 'Add to cart',
    quantity: 'Quantity',
    lineNote: 'Note for this item',
    lineNotePlaceholder: 'e.g. no sugar',
    cart: 'Cart',
    orderNote: 'Note for the waiter',
    orderNotePlaceholder: 'e.g. all at once, please',
    guestName: 'Name (optional)',
    guestNamePlaceholder: 'So the waiter can find you',
    tableNumber: 'Table no.',
    tableHelp: 'The table number is on the QR card. The waiter needs it to know where to bring your order.',
    tableRequired: 'Enter your table number',
    confirm: 'Confirm',
    total: 'Total',
    send: 'Send to waiter',
    sending: 'Sending…',
    payNote: 'No payment here — you pay the waiter as usual.',
    added: 'Added to cart',
    paused: 'Ordering is paused right now',
    pausedDefault: 'Your waiter is happy to help.',
    menu: 'Menu',
    order: 'Order',
    sentAt: 'Sent at',
    reason: 'Reason',
    autoRefresh: 'Updates automatically',
    cancelOrder: 'Cancel order',
    confirmCancel: 'Yes, cancel',
    keepOrder: 'Keep it',
    backToMenu: 'Back to the menu',
    orderAgain: 'Order again',
    earlierOrders: 'Earlier orders',
    emptyCart: 'Your cart is empty.',
    decrease: 'Decrease',
    increase: 'Increase',
    orderNotFound: 'Order not found',
    orderNotFoundBody: 'This order does not exist or was sent from another phone.',
    steps: ['Sent', 'Accepted', 'Delivered'],
    status: {
      new: {
        title: 'Sent to the waiter',
        body: 'Waiting for a waiter to pick it up, usually within a minute or two. You can cancel until it is accepted.',
        short: 'Sent',
      },
      accepted: { title: 'Accepted', body: 'Your waiter has the order and is preparing it.', short: 'Accepted' },
      delivered: { title: 'Delivered', body: 'Enjoy! Ask your waiter for the bill whenever you are ready.', short: 'Delivered' },
      rejected: {
        title: 'The waiter could not accept this order',
        body: 'Nothing was charged. You can order again or call the waiter.',
        short: 'Rejected',
      },
      expired: {
        title: 'This order expired',
        body: 'Nobody picked it up within 20 minutes. Nothing was charged — call the waiter or order again.',
        short: 'Expired',
      },
      cancelled: {
        title: 'Order cancelled',
        body: 'You cancelled it before a waiter picked it up. Nothing was charged.',
        short: 'Cancelled',
      },
    },
    errors: {
      blocked: 'Ordering from this table is temporarily disabled. Please call the waiter.',
      paused: 'Ordering is paused right now.',
      unavailable: 'Some items are no longer available. Check your cart.',
      tooMany: 'You already have 3 open orders. Wait for the waiter to deliver them.',
      tableNotFound: 'That table does not exist. Check the number on the QR card.',
      disabled: 'Ordering is not enabled.',
      rateLimited: 'Too many attempts. Please wait a moment.',
      cartFull: 'The cart is full (30 lines).',
      network: 'No connection. Check your internet and try again.',
      generic: 'Something went wrong. Please try again.',
    },
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
    yourOrders: 'Tvoje narudžbine',
    callWaiter: 'Pozovi konobara',
    bill: 'Račun',
    called: 'Pozvano',
    waiterNotified: 'Konobar je obavešten',
    viewCart: 'Pogledaj korpu',
    add: 'Dodaj',
    addToCart: 'Dodaj u korpu',
    quantity: 'Količina',
    lineNote: 'Napomena uz stavku',
    lineNotePlaceholder: 'npr. bez šećera',
    cart: 'Korpa',
    orderNote: 'Napomena za konobara',
    orderNotePlaceholder: 'npr. sve odjednom, molim',
    guestName: 'Ime (opciono)',
    guestNamePlaceholder: 'Da te konobar lakše nađe',
    tableNumber: 'Broj stola',
    tableHelp: 'Broj stola piše na kartici sa QR kodom. Potreban je da konobar zna gde da donese.',
    tableRequired: 'Upiši broj stola',
    confirm: 'Potvrdi',
    total: 'Ukupno',
    send: 'Pošalji konobaru',
    sending: 'Šaljemo…',
    payNote: 'Bez plaćanja ovde — plaćaš konobaru kao i obično.',
    added: 'Dodato u korpu',
    paused: 'Naručivanje je trenutno pauzirano',
    pausedDefault: 'Konobar je tu za vas.',
    menu: 'Meni',
    order: 'Narudžbina',
    sentAt: 'Poslato u',
    reason: 'Razlog',
    autoRefresh: 'Osvežava se automatski',
    cancelOrder: 'Otkaži narudžbinu',
    confirmCancel: 'Da, otkaži',
    keepOrder: 'Zadrži',
    backToMenu: 'Nazad na meni',
    orderAgain: 'Naruči ponovo',
    earlierOrders: 'Ranije narudžbine',
    emptyCart: 'Korpa je prazna.',
    decrease: 'Smanji',
    increase: 'Povećaj',
    orderNotFound: 'Narudžbina nije pronađena',
    orderNotFoundBody: 'Ova narudžbina ne postoji ili je poslata sa drugog telefona.',
    steps: ['Poslato', 'Prihvaćeno', 'Dostavljeno'],
    status: {
      new: {
        title: 'Poslato konobaru',
        body: 'Čeka da je konobar preuzme, obično za minut-dva. Možeš da otkažeš dok ne bude prihvaćena.',
        short: 'Poslato',
      },
      accepted: { title: 'Prihvaćeno', body: 'Konobar je preuzeo narudžbinu i priprema je.', short: 'Prihvaćeno' },
      delivered: { title: 'Dostavljeno', body: 'Prijatno! Račun tražiš od konobara kad budeš spreman.', short: 'Dostavljeno' },
      rejected: {
        title: 'Konobar nije mogao da prihvati narudžbinu',
        body: 'Ništa nije naplaćeno. Možeš da naručiš ponovo ili pozoveš konobara.',
        short: 'Odbijeno',
      },
      expired: {
        title: 'Narudžbina je istekla',
        body: 'Niko je nije preuzeo u roku od 20 minuta. Ništa nije naplaćeno — pozovi konobara ili naruči ponovo.',
        short: 'Isteklo',
      },
      cancelled: {
        title: 'Narudžbina je otkazana',
        body: 'Otkazao si je pre nego što ju je konobar preuzeo. Ništa nije naplaćeno.',
        short: 'Otkazano',
      },
    },
    errors: {
      blocked: 'Naručivanje sa ovog stola je privremeno onemogućeno. Pozovite konobara.',
      paused: 'Naručivanje je trenutno pauzirano.',
      unavailable: 'Neke stavke više nisu dostupne. Proveri korpu.',
      tooMany: 'Već imaš 3 otvorene narudžbine. Sačekaj da ih konobar dostavi.',
      tableNotFound: 'Taj sto ne postoji. Proveri broj na QR kartici.',
      disabled: 'Naručivanje nije uključeno.',
      rateLimited: 'Previše pokušaja. Sačekaj malo.',
      cartFull: 'Korpa je puna (30 stavki).',
      network: 'Nema veze. Proveri internet i pokušaj ponovo.',
      generic: 'Nešto nije u redu. Pokušaj ponovo.',
    },
  },
};

export function tagLabel(t: Dictionary, tag: string): string {
  return t.tags[tag] ?? tag;
}

export function allergenName(t: Dictionary, code: string): string {
  return t.allergenNames[code] ?? code;
}
