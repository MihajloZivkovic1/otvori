import { fileURLToPath } from 'node:url';

/** `apps/api/assets/fabrika-photos/` — the same relative path from `src/scripts` (tsx) and `dist/scripts` (production image). */
export const FABRIKA_PHOTOS_DIR = fileURLToPath(new URL('../../assets/fabrika-photos/', import.meta.url));

/**
 * The venue's own photos (Fabrika's teal/orange tray shots and the juice bottles), already square-cropped around the
 * dish to 800×800 so the item pipeline's centre crop keeps it whole. Keyed by the item's Serbian name in
 * `fabrika-menu.ts`; items not listed here have no photo yet. Used by `seed-fabrika.ts`.
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
};
