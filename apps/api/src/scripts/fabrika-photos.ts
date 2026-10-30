import { fileURLToPath } from 'node:url';

/** `apps/api/assets/fabrika-photos/` — the same relative path from `src/scripts` (tsx) and `dist/scripts` (production image). */
export const FABRIKA_PHOTOS_DIR = fileURLToPath(new URL('../../assets/fabrika-photos/', import.meta.url));

/**
 * Item photos, already squared to 800×800 so the item pipeline's centre crop keeps the dish or bottle whole. Keyed by
 * the item's Serbian name in `fabrika-menu.ts`; items not listed here have no photo yet. Used by `seed-fabrika.ts`.
 *
 * Food and the F2/F3 juices are the venue's own photos; the rest come from producers, shops and Wikimedia Commons with
 * the owner's consent. Where each file came from, and the Commons authors and licences to credit, is in
 * `assets/fabrika-photos/SOURCES.md` — keep it in step when a photo is added or replaced.
 */
export const FABRIKA_PHOTOS: Record<string, string> = {
  // Espresso drinks show the Java Coffee bags of the blends they come in (B1 = 001, B7 = 007, K = Guatemala "kafa
  // meseca", KM = Colombia), not a photo of the drink; the iced ones are made with B1/B7 only. Nes frape, srpska kafa
  // and mača late are not Java blends, so they have no photo.
  Espreso: 'java-blendovi.jpg',
  Ristreto: 'java-blendovi.jpg',
  'Dupli espreso': 'java-blendovi.jpg',
  Makijato: 'java-blendovi.jpg',
  Bebićino: 'java-blendovi.jpg',
  Kapućino: 'java-blendovi.jpg',
  'Kapućino XL': 'java-blendovi.jpg',
  'Kafe late': 'java-blendovi.jpg',
  'Late makijato': 'java-blendovi.jpg',
  'Aromatizovani kafe late': 'java-blendovi.jpg',
  'Moka espreso': 'java-blendovi.jpg',
  'Kafa afogato': 'java-blendovi.jpg',
  Amerikano: 'java-blendovi.jpg',
  'Fredo hladni espreso': 'java-blendovi-001-007.jpg',
  'Fredo kapućino': 'java-blendovi-001-007.jpg',
  'Ledena kafa': 'java-blendovi-001-007.jpg',
  'Espreso kafa 250 g': 'java-blendovi.jpg',
  'Topla čokolada': 'topla-cokolada.jpg',
  Sifon: 'sifon.jpg',
  V60: 'v60.jpg',
  Kemeks: 'kemeks.jpg',
  'Frenč pres': 'frenc-pres.jpg',
  'Aero pres': 'aero-pres.jpg',

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

  'Tart nutela': 'tart-nutela.jpg',
  'Čokoladni mafin': 'cokoladni-mafin.jpg',
  'Tart čokolada malina': 'tart-cokolada-malina.jpg',
  Sladoled: 'sladoled.jpg',

  'Branko šljiva': 'branko-sljiva.jpg',
  'Kovilj šljiva': 'kovilj-sljiva.jpg',
  'Kovilj dunja': 'kovilj-dunja.jpg',
  'Kovilj kajsija': 'kovilj-kajsija.jpg',
  'Kovilj viljamovka': 'kovilj-viljamovka.jpg',
  'Pruna od šljive': 'pruna.jpg',
  '1858 BB': '1858-bb.jpg',
  'Stara pesma': 'stara-pesma.jpg',
  Kraljica: 'kraljica.jpg',
  Koketa: 'koketa.jpg',
  Nirvana: 'nirvana.jpg',
  // "Zarić" has no photo: the menu does not say which Zarić rakija it is (Kraljica, Koketa and Nirvana are Zarić too).
};
