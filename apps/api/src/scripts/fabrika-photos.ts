import { fileURLToPath } from 'node:url';

/** `apps/api/assets/fabrika-photos/` — the same relative path from `src/scripts` (tsx) and `dist/scripts` (production image). */
export const FABRIKA_PHOTOS_DIR = fileURLToPath(new URL('../../assets/fabrika-photos/', import.meta.url));

/**
 * Item photos, already squared to 800×800 so the item pipeline's centre crop keeps the dish or bottle whole. Keyed by
 * the item's Serbian name in `fabrika-menu.ts`; items not listed here have no photo yet. Used by `seed-fabrika.ts`.
 *
 * Food and the F2/F3 juices are the venue's own photos. The drinks were taken from the web with the owner's consent:
 * packshots from the producers (Coca-Cola HBC Serbia, Knjaz Miloš, Red Bull, Heineken, Budějovický Budvar, Trebjesa,
 * Dogma Brewery, Vinarija Grumen, the Bavaria importer Calix, Coffee Bazaar for the Mad Hatter teas) or their
 * retailers, and three Wikimedia Commons photos that ask for credit: apple juice (CC BY-SA 3.0,
 * File:Apple_juice_with_3apples.jpg), blueberry (CC BY-SA 3.0, File:Blueberry_smoothie.jpg) and prosecco (CC BY 2.0,
 * laura.foto, File:Prosecco_and_snacks_in_Tuscany.jpg); the orange juice (File:Orange_juice_1_edit1.jpg) is public domain.
 */
export const FABRIKA_PHOTOS: Record<string, string> = {
  'Kapreze sendvič': 'kapreze-sendvic.jpg',
  'Mortadela i pistaći': 'mortadela-i-pistaci.jpg',
  'Kafeterija klub sendvič': 'kafeterija-klub-sendvic.jpg',
  'Chicken avocado burrito': 'chicken-avocado-burrito.jpg',
  'Crispy chicken burrito': 'crispy-chicken-burrito.jpg',
  'Italijanski tost sendvič': 'italijanski-tost-sendvic.jpg',
  'Ćuretina i brie': 'curetina-i-brie.jpg',
  'Pulled pork burger': 'pulled-pork-burger.jpg',
  'Angus bacon cheeseburger': 'angus-bacon-cheeseburger.jpg',
  'BBQ burger': 'bbq-burger.jpg',
  'Diavolo burger': 'diavolo-burger.jpg',
  'Chicken avocado burger': 'chicken-avocado-burger.jpg',
  'Steak sendvič': 'steak-sendvic.jpg',
  'Garlic parm': 'garlic-parm.jpg',
  'Truffle fries': 'truffle-fries.jpg',
  'Burger wedges': 'burger-wedges.jpg',
  'Chicken nuggets wedges': 'chicken-nuggets-wedges.jpg',
  Pomfrit: 'pomfrit.jpg',
  'Začinski krompir': 'zacinski-krompir.jpg',
  F2: 'f2.jpg',
  F3: 'f3.jpg',
  'Sok od jabuke': 'sok-od-jabuke.jpg',
  'Sok od narandže': 'sok-od-narandze.jpg',
  'Sok od borovnice': 'sok-od-borovnice.jpg',

  Zdravko: 'zdravko.jpg',
  Gari: 'gari.jpg',
  'Džindžer greni': 'dzindzer-greni.jpg',
  'Dark madnes': 'dark-madnes.jpg',
  Detoks: 'detoks.jpg',
  Greni: 'greni.jpg',
  Kamimajl: 'kamimajl.jpg',
  'Blek mango': 'blek-mango.jpg',
  'Red mednes': 'red-mednes.jpg',

  Kola: 'kola.jpg',
  Fanta: 'fanta.jpg',
  Tonik: 'tonik.jpg',
  Biter: 'biter.jpg',
  Rosa: 'rosa.jpg',
  'Knjaz Miloš': 'knjaz-milos.jpg',
  'Red Bull': 'red-bull.jpg',
  'San Pellegrino / Acqua Panna': 'san-pellegrino-acqua-panna.jpg',

  Heineken: 'heineken.jpg',
  Budweiser: 'budweiser.jpg',
  Bavaria: 'bavaria.jpg',
  'Nikšićko tamno': 'niksicko-tamno.jpg',
  Hoptopod: 'hoptopod.jpg',
  'Crna krava': 'crna-krava.jpg',
  Svetionik: 'svetionik.jpg',
  'New Pils on the Block': 'new-pils.jpg',

  'Grumen Sauvignon Blanc': 'grumen-sauvignon-blanc.jpg',
  'Grumen Petit Verdot': 'grumen-petit-verdot.jpg',
  Prosecco: 'prosecco.jpg',
};
