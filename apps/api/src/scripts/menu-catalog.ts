import type { Transaction } from 'sequelize';
import type { TranslatedText } from '@qr-menu/shared';
import { Category, ItemVariant, MenuItem } from '../db/models/index.js';
import { processItemImage, processItemThumbnail } from '../utils/images.js';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/storage.js';

/**
 * Demo menu catalog shared by the `seed:drinks` and `seed:venues` scripts: drink and food categories (sr + en,
 * variants, allergens) with a Wikimedia Commons photo per item, plus the helpers that write a menu into a venue
 * and attach the photos exactly like a CMS upload (800×800 WebP + 160×160 thumbnail through the storage driver).
 */

export interface CatalogVariant {
  name: string;
  priceCents: number;
}
export interface CatalogItem {
  name: TranslatedText;
  description?: TranslatedText;
  /** Minor units (RSD × 100). */
  priceCents: number;
  allergens?: string[];
  tags?: string[];
  variants?: CatalogVariant[];
  /** Heading of the variant group ("Vrsta kafe"); default "Size". */
  variantLabel?: TranslatedText;
  /** Wikimedia Commons file title (without the "File:" prefix). */
  photo?: string;
}
export interface CatalogCategory {
  name: TranslatedText;
  items: CatalogItem[];
}

export const rsd = (amount: number) => Math.round(amount * 100);
const sr = (sr: string, en: string): TranslatedText => ({ sr, en });

/** Only the named items (Serbian names, in the given order); a name that is not in the category throws. */
export function pick(category: CatalogCategory, names: string[], rename?: TranslatedText): CatalogCategory {
  const items = names.map((name) => {
    const item = category.items.find((candidate) => candidate.name.sr === name);
    if (!item) throw new Error(`No item "${name}" in category "${category.name.sr}"`);
    return item;
  });
  return { name: rename ?? category.name, items };
}

/** Every price (variants included) multiplied by `factor` and rounded to 10 RSD. */
export function priced(category: CatalogCategory, factor: number): CatalogCategory {
  const scale = (cents: number) => Math.round((cents * factor) / 1000) * 1000;
  return {
    ...category,
    items: category.items.map((item) => ({
      ...item,
      priceCents: scale(item.priceCents),
      variants: item.variants?.map((variant) => ({ ...variant, priceCents: scale(variant.priceCents) })),
    })),
  };
}

// ─── Drinks ───

export const COFFEE: CatalogCategory = {
  name: sr('Kafa', 'Coffee'),
  items: [
    { name: sr('Espresso', 'Espresso'), description: sr('Sveže mlevena arabika, 30 ml', 'Freshly ground arabica, 30 ml'), priceCents: rsd(200), photo: 'Tazzina di caffè a Ventimiglia.jpg' },
    { name: sr('Dupli espresso', 'Double espresso'), description: sr('Dva šota u jednoj šoljici', 'Two shots in one cup'), priceCents: rsd(280), photo: 'Double espresso (2259728230).jpg' },
    { name: sr('Makijato', 'Macchiato'), description: sr('Espresso sa kapom mlečne pene', 'Espresso topped with milk foam'), priceCents: rsd(220), allergens: ['M'], photo: 'Caffè macchiato.jpg' },
    { name: sr('Kapućino', 'Cappuccino'), description: sr('Espresso, toplo mleko i gusta pena', 'Espresso, steamed milk and thick foam'), priceCents: rsd(280), allergens: ['M'], photo: 'Cappuccino PeB.jpg' },
    { name: sr('Kafe late', 'Caffè latte'), description: sr('Blaga kafa sa puno mleka', 'Mild coffee with plenty of milk'), priceCents: rsd(300), allergens: ['M'], variants: [{ name: 'Mala', priceCents: rsd(300) }, { name: 'Velika', priceCents: rsd(360) }], photo: 'Latte art.jpg' },
    { name: sr('Flat white', 'Flat white'), description: sr('Dupli espresso sa baršunastim mlekom', 'Double espresso with velvety milk'), priceCents: rsd(320), allergens: ['M'], photo: 'Flat white coffee with pretty feather pattern.jpg' },
    { name: sr('Americano', 'Americano'), description: sr('Espresso produžen vrelom vodom', 'Espresso lengthened with hot water'), priceCents: rsd(240), photo: 'A small cup of coffee.JPG' },
    { name: sr('Domaća kafa', 'Turkish coffee'), description: sr('Kuvana u džezvi, sa ratlukom', 'Brewed in a džezva, served with Turkish delight'), priceCents: rsd(180), photo: 'Turkish coffee.jpg' },
    { name: sr('Nes kafa', 'Instant coffee'), description: sr('Topla ili hladna, sa mlekom po želji', 'Hot or cold, milk on request'), priceCents: rsd(220), photo: 'Nescafé Cup Winter.jpg' },
    { name: sr('Ledena kafa', 'Iced latte'), description: sr('Espresso, hladno mleko i led', 'Espresso, cold milk and ice'), priceCents: rsd(350), allergens: ['M'], tags: ['new'], photo: 'Iced coffee.jpg' },
    { name: sr('Frape', 'Frappé'), description: sr('Blendirana ledena kafa sa šlagom', 'Blended iced coffee with whipped cream'), priceCents: rsd(350), allergens: ['M'], variants: [{ name: 'Vanila', priceCents: rsd(350) }, { name: 'Čokolada', priceCents: rsd(350) }, { name: 'Karamel', priceCents: rsd(370) }], photo: 'Frappé.jpg' },
    { name: sr('Afogato', 'Affogato'), description: sr('Kugla vanila sladoleda prelivena espressom', 'A scoop of vanilla ice cream drowned in espresso'), priceCents: rsd(360), allergens: ['M'], photo: 'Affogato with Amarretti Biscotti - Tavola Di Famiglia 2026-02-27.jpg' },
  ],
};
export const HOT_DRINKS: CatalogCategory = {
  name: sr('Topli napici i čajevi', 'Hot drinks & tea'),
  items: [
    { name: sr('Topla čokolada', 'Hot chocolate'), description: sr('Gusta, sa šlagom', 'Thick, with whipped cream'), priceCents: rsd(320), allergens: ['M'], photo: 'Hot chocolate.jpg' },
    { name: sr('Crni čaj', 'Black tea'), description: sr('Sa limunom ili mlekom', 'With lemon or milk'), priceCents: rsd(200), photo: 'Cup of tea, Scotland.jpg' },
    { name: sr('Zeleni čaj', 'Green tea'), priceCents: rsd(200), photo: 'Green tea.jpg' },
    { name: sr('Čaj od nane', 'Mint tea'), description: sr('Sveža nana, med po želji', 'Fresh mint, honey on request'), priceCents: rsd(200), photo: 'Mint tea.jpg' },
    { name: sr('Kamilica', 'Chamomile tea'), priceCents: rsd(200), photo: 'Flickr - cyclonebill - Kamillete.jpg' },
    { name: sr('Voćni čaj', 'Fruit tea'), description: sr('Hibiskus i šumsko voće', 'Hibiscus and forest fruit'), priceCents: rsd(200), photo: 'Fruit tea (hot).jpg' },
    { name: sr('Čaj late', 'Chai latte'), description: sr('Začinjeni crni čaj sa penastim mlekom', 'Spiced black tea with frothed milk'), priceCents: rsd(330), allergens: ['M'], photo: 'Masala Chai.JPG' },
  ],
};
export const SOFT_DRINKS: CatalogCategory = {
  name: sr('Bezalkoholna pića', 'Soft drinks'),
  items: [
    { name: sr('Voda', 'Still water'), description: sr('Rosa', 'Rosa'), priceCents: rsd(180), variants: [{ name: '0,33 l', priceCents: rsd(180) }, { name: '0,75 l', priceCents: rsd(300) }], photo: 'Glass of water.jpg' },
    { name: sr('Kisela voda', 'Sparkling water'), description: sr('Knjaz Miloš', 'Knjaz Miloš'), priceCents: rsd(180), variants: [{ name: '0,25 l', priceCents: rsd(180) }, { name: '0,75 l', priceCents: rsd(300) }], photo: 'Glass of carbonated water, Rovisco Pais Avenue, Lisbon, Portugal julesvernex2.jpg' },
    { name: sr('Coca-Cola', 'Coca-Cola'), description: sr('0,25 l', '0.25 l'), priceCents: rsd(280), variants: [{ name: 'Original', priceCents: rsd(280) }, { name: 'Zero', priceCents: rsd(280) }], photo: 'Glass cola.jpg' },
    { name: sr('Fanta', 'Fanta'), description: sr('0,25 l', '0.25 l'), priceCents: rsd(280), photo: 'Fanta Orange.jpg' },
    { name: sr('Sprite', 'Sprite'), description: sr('0,25 l', '0.25 l'), priceCents: rsd(280), photo: 'Lemon lime soda.jpg' },
    { name: sr('Schweppes', 'Schweppes'), description: sr('0,25 l', '0.25 l'), priceCents: rsd(280), variants: [{ name: 'Tonic', priceCents: rsd(280) }, { name: 'Bitter lemon', priceCents: rsd(280) }], photo: 'Tonic water.jpg' },
    { name: sr('Ledeni čaj', 'Iced tea'), description: sr('0,25 l', '0.25 l'), priceCents: rsd(280), variants: [{ name: 'Breskva', priceCents: rsd(280) }, { name: 'Limun', priceCents: rsd(280) }], photo: 'Iced tea.jpg' },
    { name: sr('Sok od pomorandže', 'Orange juice'), description: sr('Next, 0,2 l', 'Next, 0.2 l'), priceCents: rsd(250), photo: 'Orange juice 1 edit1.jpg' },
    { name: sr('Sok od jabuke', 'Apple juice'), description: sr('Next, 0,2 l', 'Next, 0.2 l'), priceCents: rsd(250), photo: 'Apfelsaft.jpg' },
    { name: sr('Sok od borovnice', 'Blueberry juice'), description: sr('Next, 0,2 l', 'Next, 0.2 l'), priceCents: rsd(250), photo: 'Cranberry juice.jpg' },
    { name: sr('Sok od višnje', 'Sour cherry juice'), description: sr('Next, 0,2 l', 'Next, 0.2 l'), priceCents: rsd(250), photo: 'Cherry juice 259A7261.jpg' },
    { name: sr('Energetsko piće', 'Energy drink'), description: sr('Red Bull, 0,25 l', 'Red Bull, 0.25 l'), priceCents: rsd(350), photo: 'Red Bull ice.jpg' },
  ],
};
export const FRESH_JUICES: CatalogCategory = {
  name: sr('Sveže ceđeno i smoothie', 'Fresh juices & smoothies'),
  items: [
    { name: sr('Ceđena pomorandža', 'Fresh orange juice'), description: sr('0,3 l, ceđeno pred vama', '0.3 l, squeezed in front of you'), priceCents: rsd(390), tags: ['vegan'], photo: 'Fresh orange juice.jpg' },
    { name: sr('Limunada', 'Lemonade'), description: sr('Limun, nana, led', 'Lemon, mint, ice'), priceCents: rsd(300), tags: ['vegan'], photo: 'Glass of lemonade.jpg' },
    { name: sr('Limunada sa jagodom', 'Strawberry lemonade'), description: sr('Domaća limunada sa svežim jagodama', 'Homemade lemonade with fresh strawberries'), priceCents: rsd(350), tags: ['vegan', 'new'], photo: 'Lemonade with strawberry.jpg' },
    { name: sr('Sok od jagode', 'Fresh strawberry juice'), description: sr('0,3 l, sveže voće', '0.3 l, fresh fruit'), priceCents: rsd(390), tags: ['vegan'], photo: 'Glass of strawberry juice 20180815.jpg' },
    { name: sr('Smoothie jagoda-banana', 'Strawberry banana smoothie'), description: sr('Sa jogurtom i medom', 'With yoghurt and honey'), priceCents: rsd(420), allergens: ['M'], photo: 'Strawberry smoothie.jpg' },
    { name: sr('Zeleni smoothie', 'Green smoothie'), description: sr('Spanać, jabuka, krastavac, limun', 'Spinach, apple, cucumber, lemon'), priceCents: rsd(420), tags: ['vegan'], photo: 'Green smoothie.jpg' },
  ],
};
export const BEER: CatalogCategory = {
  name: sr('Pivo', 'Beer'),
  items: [
    { name: sr('Jelen', 'Jelen'), description: sr('0,33 l', '0.33 l'), priceCents: rsd(280), allergens: ['G'], photo: 'Lager beer in glass.jpg' },
    { name: sr('Lav', 'Lav'), description: sr('0,33 l', '0.33 l'), priceCents: rsd(280), allergens: ['G'], photo: 'NCI Visuals Food Beer.jpg' },
    { name: sr('Heineken', 'Heineken'), description: sr('0,33 l', '0.33 l'), priceCents: rsd(350), allergens: ['G'], photo: 'Heineken Pilsener Bier (224294318).jpg' },
    { name: sr('Točeno pivo', 'Draught beer'), description: sr('Zaječarsko', 'Zaječarsko'), priceCents: rsd(250), allergens: ['G'], variants: [{ name: '0,3 l', priceCents: rsd(250) }, { name: '0,5 l', priceCents: rsd(350) }], photo: 'GuinnessPint.jpg' },
    { name: sr('Pšenično pivo', 'Wheat beer'), description: sr('Paulaner, 0,5 l', 'Paulaner, 0.5 l'), priceCents: rsd(450), allergens: ['G'], photo: 'König Ludwig Weissbier at restaurant Solmu.jpg' },
    { name: sr('Tamno pivo', 'Dark lager'), description: sr('0,33 l', '0.33 l'), priceCents: rsd(380), allergens: ['G'], photo: 'Prague Praha 2014 Holmstad U Fleku Nove Mesto Beer Hall ølhall Glass of dark beer.jpg' },
    { name: sr('Craft IPA', 'Craft IPA'), description: sr('Domaća pivara, 0,33 l', 'Local brewery, 0.33 l'), priceCents: rsd(490), allergens: ['G'], tags: ['new'], photo: 'Glass and bottle of Lagunitas IPA.jpg' },
    { name: sr('Bezalkoholno pivo', 'Non-alcoholic beer'), description: sr('0,33 l', '0.33 l'), priceCents: rsd(300), allergens: ['G'], photo: 'Tyskie beer bottle with beer glass, Wikimania 2024 (01).jpg' },
  ],
};
export const WINE: CatalogCategory = {
  name: sr('Vino', 'Wine'),
  items: [
    { name: sr('Crno vino', 'Red wine'), description: sr('Prokupac, Župa', 'Prokupac, Župa'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Wine being poured into a glass.jpg' },
    { name: sr('Belo vino', 'White wine'), description: sr('Tamjanika, Oplenac', 'Tamjanika, Oplenac'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Glass of white wine.jpg' },
    { name: sr('Roze vino', 'Rosé wine'), description: sr('Fruška gora', 'Fruška gora'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Rose wine.jpg' },
    { name: sr('Prosecco', 'Prosecco'), description: sr('DOC, Italija', 'DOC, Italy'), priceCents: rsd(450), allergens: ['S'], variants: [{ name: 'Čaša 0,1 l', priceCents: rsd(450) }, { name: 'Flaša 0,75 l', priceCents: rsd(2400) }], photo: 'Prosecco di Conegliano bottle and glass.jpg' },
  ],
};
export const SPIRITS: CatalogCategory = {
  name: sr('Žestoka pića', 'Spirits'),
  items: [
    { name: sr('Šljivovica', 'Plum brandy'), description: sr('Domaća, 0,03 l', 'Homemade, 0.03 l'), priceCents: rsd(250), photo: 'Šljivovica (Serbian Slivovitz).jpg' },
    { name: sr('Dunjevača', 'Quince brandy'), description: sr('0,03 l', '0.03 l'), priceCents: rsd(300), photo: 'Rakija.jpg' },
    { name: sr('Kajsijevača', 'Apricot brandy'), description: sr('0,03 l', '0.03 l'), priceCents: rsd(300), photo: 'Sopron barack 07.JPG' },
    { name: sr('Viski', 'Whisky'), description: sr('Johnnie Walker Red, 0,03 l', 'Johnnie Walker Red, 0.03 l'), priceCents: rsd(400), photo: 'Glass of whisky.jpg' },
    { name: sr("Jack Daniel's", "Jack Daniel's"), description: sr('0,03 l', '0.03 l'), priceCents: rsd(450), photo: 'Jack Daniels bottle.jpg' },
    { name: sr('Vodka', 'Vodka'), description: sr('Absolut, 0,03 l', 'Absolut, 0.03 l'), priceCents: rsd(350), photo: 'Pear vodka bottle and glass with ice cube (18062327223).jpg' },
    { name: sr('Tekila', 'Tequila'), description: sr('0,03 l, so i limeta', '0.03 l, salt and lime'), priceCents: rsd(380), photo: 'Tequila.jpg' },
    { name: sr('Jägermeister', 'Jägermeister'), description: sr('0,03 l, ledeno', '0.03 l, ice cold'), priceCents: rsd(350), photo: 'Jägermeister.jpg' },
    { name: sr('Baileys', 'Baileys'), description: sr('0,05 l, sa ledom', '0.05 l, on ice'), priceCents: rsd(380), allergens: ['M'], photo: 'Baileys.jpg' },
    { name: sr('Campari', 'Campari'), description: sr('0,05 l, sa sodom ili sokom', '0.05 l, with soda or juice'), priceCents: rsd(380), photo: 'Campari Soda retouched.jpg' },
  ],
};
export const COCKTAILS: CatalogCategory = {
  name: sr('Kokteli', 'Cocktails'),
  items: [
    { name: sr('Mojito', 'Mojito'), description: sr('Rum, limeta, nana, soda', 'Rum, lime, mint, soda'), priceCents: rsd(650), photo: 'Fresh Mojito Premium.jpg' },
    { name: sr('Aperol Spritz', 'Aperol Spritz'), description: sr('Aperol, prosecco, soda', 'Aperol, prosecco, soda'), priceCents: rsd(650), allergens: ['S'], photo: 'Aperol Spritz - Santa Ynez Kitchen - Sarah Stierch.jpg' },
    { name: sr('Gin tonik', 'Gin & tonic'), description: sr('Gin, tonik, krastavac', 'Gin, tonic, cucumber'), priceCents: rsd(550), photo: 'Gin and Tonic with ingredients.jpg' },
    { name: sr('Margarita', 'Margarita'), description: sr('Tekila, triple sec, limeta', 'Tequila, triple sec, lime'), priceCents: rsd(650), photo: 'MargaritaReal.jpg' },
    { name: sr('Negroni', 'Negroni'), description: sr('Gin, Campari, crveni vermut', 'Gin, Campari, sweet vermouth'), priceCents: rsd(700), photo: 'Negroni served in Vancouver BC.jpg' },
    { name: sr('Cuba Libre', 'Cuba Libre'), description: sr('Rum, kola, limeta', 'Rum, cola, lime'), priceCents: rsd(600), photo: 'Cuba Libre.jpg' },
    { name: sr('Piña Colada', 'Piña Colada'), description: sr('Rum, kokos, ananas', 'Rum, coconut, pineapple'), priceCents: rsd(700), photo: 'Pina colada.jpg' },
    { name: sr('Long Island Iced Tea', 'Long Island Iced Tea'), description: sr('Pet žestina, kola, limun', 'Five spirits, cola, lemon'), priceCents: rsd(800), photo: 'Long Island Iced Tea with Lemon and Straw.jpg' },
    { name: sr('Cosmopolitan', 'Cosmopolitan'), description: sr('Vodka, triple sec, brusnica', 'Vodka, triple sec, cranberry'), priceCents: rsd(650), photo: 'Cosmopolitan.jpg' },
    { name: sr('Hugo', 'Hugo'), description: sr('Prosecco, zova, nana', 'Prosecco, elderflower, mint'), priceCents: rsd(600), allergens: ['S'], tags: ['new'], photo: '15-09-26-RalfR-WLC-0059.jpg' },
    { name: sr('Espresso Martini', 'Espresso Martini'), description: sr('Vodka, espresso, liker od kafe', 'Vodka, espresso, coffee liqueur'), priceCents: rsd(700), photo: 'Espresso Martini.jpg' },
  ],
};

// ─── Food ───

const pizzaSizes = (small: number, large: number): CatalogVariant[] => [
  { name: '32 cm', priceCents: rsd(small) },
  { name: '50 cm', priceCents: rsd(large) },
];

export const PIZZA: CatalogCategory = {
  name: sr('Pice', 'Pizza'),
  items: [
    { name: sr('Margarita', 'Margherita'), description: sr('Pelat, mocarela, bosiljak', 'Tomato, mozzarella, basil'), priceCents: rsd(790), allergens: ['G', 'M'], variants: pizzaSizes(790, 1490), photo: 'Neapolitan pizza at Trappica (48701940197).jpg' },
    { name: sr('Kapričoza', 'Capricciosa'), description: sr('Pelat, mocarela, šunka, šampinjoni, masline', 'Tomato, mozzarella, ham, mushrooms, olives'), priceCents: rsd(950), allergens: ['G', 'M'], variants: pizzaSizes(950, 1790), photo: 'Pizza capricciosa 03.jpg' },
    { name: sr('Funghi', 'Funghi'), description: sr('Pelat, mocarela, šampinjoni, origano', 'Tomato, mozzarella, mushrooms, oregano'), priceCents: rsd(850), allergens: ['G', 'M'], variants: pizzaSizes(850, 1590), photo: 'Pizza Funghi mit Pizzahalter.JPG' },
    { name: sr('Quattro formaggi', 'Quattro formaggi'), description: sr('Mocarela, gorgonzola, parmezan, ementaler', 'Mozzarella, gorgonzola, parmesan, emmental'), priceCents: rsd(1050), allergens: ['G', 'M'], variants: pizzaSizes(1050, 1990), photo: 'Италия 4 сыр пиццасы.jpg' },
    { name: sr('Quattro stagioni', 'Quattro stagioni'), description: sr('Šunka, šampinjoni, artičoke, masline', 'Ham, mushrooms, artichokes, olives'), priceCents: rsd(990), allergens: ['G', 'M'], variants: pizzaSizes(990, 1890), photo: 'Pizza Quattro Stagioni.jpg' },
    { name: sr('Kulen', 'Kulen'), description: sr('Pelat, mocarela, sremski kulen, ljuta papričica', 'Tomato, mozzarella, Srem kulen sausage, chilli'), priceCents: rsd(990), allergens: ['G', 'M'], tags: ['spicy'], variants: pizzaSizes(990, 1890), photo: 'Pepperoni Pizza (29204589095).jpg' },
    { name: sr('Pršuta', 'Prosciutto'), description: sr('Mocarela, pršuta, rukola, parmezan', 'Mozzarella, prosciutto, rocket, parmesan'), priceCents: rsd(1150), allergens: ['G', 'M'], variants: pizzaSizes(1150, 2190), photo: 'Prosciutto Rucola - tomato, mozzarella, arugula, prosciutto di Parma, pecorino (16103892980).jpg' },
    { name: sr('Tuna', 'Tuna'), description: sr('Pelat, mocarela, tunjevina, crveni luk', 'Tomato, mozzarella, tuna, red onion'), priceCents: rsd(990), allergens: ['G', 'M', 'F'], variants: pizzaSizes(990, 1890), photo: 'Pizza Tonno Cipolla.jpg' },
    { name: sr('Vegetarijana', 'Vegetariana'), description: sr('Tikvice, paprika, patlidžan, šampinjoni', 'Courgette, pepper, aubergine, mushrooms'), priceCents: rsd(890), allergens: ['G', 'M'], variants: pizzaSizes(890, 1690), photo: 'Vegetarian Pizza.jpg' },
  ],
};

export const PASTA: CatalogCategory = {
  name: sr('Paste', 'Pasta'),
  items: [
    { name: sr('Karbonara', 'Carbonara'), description: sr('Špagete, panceta, žumance, parmezan', 'Spaghetti, pancetta, egg yolk, parmesan'), priceCents: rsd(890), allergens: ['G', 'E', 'M'], photo: 'Espaguetis carbonara.jpg' },
    { name: sr('Bolonjeze', 'Bolognese'), description: sr('Tagliatelle sa ragu sosom od junetine', 'Tagliatelle with beef ragù'), priceCents: rsd(850), allergens: ['G', 'M', 'C'], photo: 'Tagliatelle al ragù (image modified).jpg' },
    { name: sr('Arabijata', 'Arrabbiata'), description: sr('Pene, paradajz, beli luk, ljuta papričica', 'Penne, tomato, garlic, chilli'), priceCents: rsd(750), allergens: ['G'], tags: ['vegan', 'spicy'], photo: 'Penne Arrabbiata.jpg' },
    { name: sr('Pesto', 'Pesto'), description: sr('Bosiljak, pinjoli, parmezan, maslinovo ulje', 'Basil, pine nuts, parmesan, olive oil'), priceCents: rsd(850), allergens: ['G', 'M', 'N'], photo: 'Pasta al pesto fatto in casa.jpg' },
    { name: sr('Njoke sa četiri sira', 'Four-cheese gnocchi'), priceCents: rsd(920), allergens: ['G', 'M', 'E'], photo: 'Gnocchi di ricotta burro e salvia.jpg' },
    { name: sr('Lazanje', 'Lasagne'), description: sr('Ragu, bešamel, mocarela', 'Ragù, béchamel, mozzarella'), priceCents: rsd(950), allergens: ['G', 'M', 'E'], photo: 'Lasagne - stonesoup.jpg' },
  ],
};

export const SALADS: CatalogCategory = {
  name: sr('Salate', 'Salads'),
  items: [
    { name: sr('Šopska salata', 'Shopska salad'), description: sr('Paradajz, krastavac, paprika, luk, sir', 'Tomato, cucumber, pepper, onion, white cheese'), priceCents: rsd(390), allergens: ['M'], photo: 'Chopska.jpg' },
    { name: sr('Grčka salata', 'Greek salad'), description: sr('Feta, masline, paradajz, krastavac', 'Feta, olives, tomato, cucumber'), priceCents: rsd(450), allergens: ['M'], photo: 'Greece Food Horiatiki.JPG' },
    { name: sr('Cezar salata', 'Caesar salad'), description: sr('Piletina, zelena salata, krutoni, parmezan', 'Chicken, lettuce, croutons, parmesan'), priceCents: rsd(750), allergens: ['G', 'M', 'E', 'F'], photo: 'Caesar salad (2).jpg' },
    { name: sr('Salata sa tunjevinom', 'Tuna salad'), description: sr('Tunjevina, pasulj, crveni luk, rukola', 'Tuna, beans, red onion, rocket'), priceCents: rsd(690), allergens: ['F'], photo: 'Salad with beans and tuna.jpg' },
    { name: sr('Urnebes', 'Urnebes'), description: sr('Ljuti sirni namaz', 'Spicy cheese spread'), priceCents: rsd(290), allergens: ['M'], tags: ['spicy'], photo: 'Urnebes salade.JPG' },
  ],
};

export const SANDWICHES: CatalogCategory = {
  name: sr('Sendviči', 'Sandwiches'),
  items: [
    { name: sr('Klub sendvič', 'Club sandwich'), description: sr('Piletina, slanina, jaje, paradajz, pomfrit', 'Chicken, bacon, egg, tomato, fries'), priceCents: rsd(690), allergens: ['G', 'E', 'M'], photo: 'Club sandwich at Café Picnic.jpg' },
    { name: sr('Sendvič šunka i sir', 'Ham & cheese sandwich'), description: sr('Domaća pogača, šunka, kačkavalj', 'Homemade bread, ham, kashkaval'), priceCents: rsd(450), allergens: ['G', 'M'], photo: 'Ham sandwich1.jpg' },
    { name: sr('Pileći sendvič', 'Chicken sandwich'), description: sr('Pileći file, majonez, zelena salata', 'Chicken breast, mayonnaise, lettuce'), priceCents: rsd(590), allergens: ['G', 'E'], photo: 'Chicken salad sandwich 01.jpg' },
    { name: sr('Tost', 'Toastie'), description: sr('Šunka i kačkavalj', 'Ham and kashkaval'), priceCents: rsd(350), allergens: ['G', 'M'], photo: 'Ham and Cheese Toastie, Epoch Cafe, 2026 (01).jpg' },
    { name: sr('Tortilja sa piletinom', 'Chicken wrap'), description: sr('Piletina, avokado, povrće, sos', 'Chicken, avocado, vegetables, dressing'), priceCents: rsd(650), allergens: ['G', 'M'], photo: 'Smoked chicken and avocado wrap.jpg' },
    { name: sr('Humus sendvič', 'Hummus sandwich'), description: sr('Humus, grilovano povrće, rukola', 'Hummus, grilled vegetables, rocket'), priceCents: rsd(550), allergens: ['G', 'Se'], tags: ['vegan'], photo: 'Lebanese style hummus.jpg' },
  ],
};

export const BURGERS: CatalogCategory = {
  name: sr('Burgeri', 'Burgers'),
  items: [
    { name: sr('Klasik burger', 'Classic burger'), description: sr('180 g junetine, zelena salata, paradajz, sos', '180 g beef, lettuce, tomato, house sauce'), priceCents: rsd(790), allergens: ['G', 'E', 'Se'], photo: 'RedDot Burger.jpg' },
    { name: sr('Čizburger', 'Cheeseburger'), description: sr('180 g junetine, čedar, kiseli krastavčići', '180 g beef, cheddar, pickles'), priceCents: rsd(850), allergens: ['G', 'M', 'E', 'Se'], photo: 'Cheeseburger.jpg' },
    { name: sr('Bekon burger', 'Bacon burger'), description: sr('Junetina, slanina, čedar, BBQ sos', 'Beef, bacon, cheddar, BBQ sauce'), priceCents: rsd(950), allergens: ['G', 'M', 'E', 'Se'], photo: 'Klompus Burger With Bacon and French Fries.jpg' },
    { name: sr('Smeš burger', 'Smash burger'), description: sr('Dve tanke pljeskavice, dupli čedar', 'Two thin patties, double cheddar'), priceCents: rsd(1050), allergens: ['G', 'M', 'E', 'Se'], tags: ['new'], photo: 'Sriracha Double Smash Burger.jpg' },
    { name: sr('Pileći burger', 'Chicken burger'), description: sr('Pileći file sa roštilja, coleslaw', 'Grilled chicken breast, coleslaw'), priceCents: rsd(790), allergens: ['G', 'E', 'Se'], photo: 'Chargrilled Chicken Burger - Leon.jpg' },
    { name: sr('Vege burger', 'Veggie burger'), description: sr('Pljeskavica od leblebija i povrća', 'Chickpea and vegetable patty'), priceCents: rsd(790), allergens: ['G', 'Se'], tags: ['vegan'], photo: 'המבורגר טבעוני.jpg' },
  ],
};

export const GRILL: CatalogCategory = {
  name: sr('Roštilj i glavna jela', 'Grill & mains'),
  items: [
    { name: sr('Ćevapi', 'Ćevapi'), description: sr('U lepinji, sa lukom i kajmakom', 'In flatbread, with onion and kajmak'), priceCents: rsd(590), allergens: ['G', 'M'], variants: [{ name: '5 kom', priceCents: rsd(590) }, { name: '10 kom', priceCents: rsd(890) }], photo: 'Cevapi s kajmakom.jpg' },
    { name: sr('Pljeskavica', 'Pljeskavica'), description: sr('250 g, sa prilogom po izboru', '250 g, with a side of your choice'), priceCents: rsd(790), allergens: ['G'], photo: 'Pleskavitsa.JPG' },
    { name: sr('Karađorđeva šnicla', 'Karađorđe schnitzel'), description: sr('Punjena kajmakom, sa tartar sosom', 'Filled with kajmak, with tartar sauce'), priceCents: rsd(1150), allergens: ['G', 'M', 'E'], photo: 'Karađorđeva šnicla.jpg' },
    { name: sr('Bečka šnicla', 'Wiener schnitzel'), description: sr('Teleća, sa limunom', 'Veal, with lemon'), priceCents: rsd(1090), allergens: ['G', 'E'], photo: 'Wiener-Schnitzel02.jpg' },
    { name: sr('Piletina na žaru', 'Grilled chicken'), description: sr('Pileći file, grilovane tikvice', 'Chicken breast, grilled courgette'), priceCents: rsd(850), photo: 'Pesto Chicken and Grilled Zucchini.jpg' },
    { name: sr('Svinjski vrat', 'Pork neck steak'), description: sr('Sa roštilja, 300 g', 'Grilled, 300 g'), priceCents: rsd(950), photo: '02021 0921 (3) Grilled pork neck fillet steak witt red cabbage.jpg' },
    { name: sr('Mešano meso za dvoje', 'Mixed grill for two'), description: sr('Ćevapi, pljeskavica, vrat, kobasica, piletina, pomfrit', 'Ćevapi, pljeskavica, pork neck, sausage, chicken, fries'), priceCents: rsd(2400), allergens: ['G'], photo: 'Delicious plate of grilled meat served with crispy fries and fresh vegetables on a wooden table.jpg' },
  ],
};

export const SIDES: CatalogCategory = {
  name: sr('Prilozi', 'Sides'),
  items: [
    { name: sr('Pomfrit', 'French fries'), priceCents: rsd(250), tags: ['vegan'], variants: [{ name: 'Mali', priceCents: rsd(250) }, { name: 'Veliki', priceCents: rsd(350) }], photo: 'French Fries.JPG' },
    { name: sr('Pekarski krompir', 'Roast potatoes'), priceCents: rsd(320), tags: ['vegan'], photo: 'Roasted Potato Wedges with Shallots and Rosemary (5706897999).jpg' },
    { name: sr('Grilovano povrće', 'Grilled vegetables'), priceCents: rsd(390), tags: ['vegan'], photo: 'Ready Grilled vegetables.jpg' },
    { name: sr('Kajmak', 'Kajmak'), priceCents: rsd(250), allergens: ['M'] },
    { name: sr('Lepinja', 'Flatbread'), priceCents: rsd(80), allergens: ['G'] },
  ],
};

export const BREAKFAST: CatalogCategory = {
  name: sr('Doručak', 'Breakfast'),
  items: [
    { name: sr('Omlet', 'Omelette'), description: sr('Tri jaja, šunka i sir, tost', 'Three eggs, ham and cheese, toast'), priceCents: rsd(450), allergens: ['E', 'M', 'G'], photo: 'Gorgonzola + Bacon Omelette @ Omelegg @ Amsterdam (16600947041).jpg' },
    { name: sr('Kajgana sa slaninom', 'Scrambled eggs with bacon'), priceCents: rsd(490), allergens: ['E', 'G'], photo: 'Scrambed eggs.jpg' },
    { name: sr('Engleski doručak', 'Full English breakfast'), description: sr('Jaja, slanina, kobasica, pasulj, tost', 'Eggs, bacon, sausage, beans, toast'), priceCents: rsd(790), allergens: ['G', 'E'], photo: 'Full English breakfast (cropped).jpg' },
    { name: sr('Avokado tost', 'Avocado toast'), description: sr('Kiselo testo, avokado, čeri paradajz', 'Sourdough, avocado, cherry tomatoes'), priceCents: rsd(590), allergens: ['G'], tags: ['vegan', 'new'], photo: 'Avocado toast at Voyager Espresso (33134505776).jpg' },
    { name: sr('Ovsena kaša', 'Porridge'), description: sr('Sa voćem i medom', 'With fruit and honey'), priceCents: rsd(420), allergens: ['G', 'M'], photo: 'Oatmeal (1).jpg' },
    { name: sr('Kroasan', 'Croissant'), priceCents: rsd(220), allergens: ['G', 'M', 'E'], variants: [{ name: 'Prazan', priceCents: rsd(220) }, { name: 'Čokolada', priceCents: rsd(260) }, { name: 'Šunka i sir', priceCents: rsd(320) }], photo: 'Croissant-Petr Kratochvil.jpg' },
  ],
};

export const BAKERY: CatalogCategory = {
  name: sr('Pite i peciva', 'Pies & pastries'),
  items: [
    { name: sr('Gibanica', 'Gibanica'), description: sr('Domaća pita sa sirom i jajima', 'Homemade cheese and egg pie'), priceCents: rsd(260), allergens: ['G', 'M', 'E'], photo: 'Gibanica single slice with full pie in background.jpg' },
    { name: sr('Burek', 'Burek'), priceCents: rsd(320), allergens: ['G'], variants: [{ name: 'Meso', priceCents: rsd(320) }, { name: 'Sir', priceCents: rsd(300) }], photo: 'Meat burek (GAK bakery, Belgrade, Serbia).jpg' },
    { name: sr('Zeljanica', 'Spinach pie'), priceCents: rsd(260), allergens: ['G', 'M', 'E'], photo: 'Spanakopita.jpg' },
    { name: sr('Pita sa sirom', 'Cheese pie'), priceCents: rsd(260), allergens: ['G', 'M', 'E'], photo: 'Pita sa sirom 2.jpg' },
    { name: sr('Kiflice', 'Kifli rolls'), description: sr('Domaće, 5 komada', 'Homemade, 5 pieces'), priceCents: rsd(200), allergens: ['G', 'M'], photo: 'Kifli.jpg' },
  ],
};

export const DESSERTS: CatalogCategory = {
  name: sr('Dezerti', 'Desserts'),
  items: [
    { name: sr('Palačinke', 'Crêpes'), priceCents: rsd(350), allergens: ['G', 'M', 'E'], variants: [{ name: 'Nutela', priceCents: rsd(390) }, { name: 'Plazma i Nutela', priceCents: rsd(450) }, { name: 'Džem', priceCents: rsd(350) }], photo: 'Crepes dsc07085.jpg' },
    { name: sr('Tiramisu', 'Tiramisu'), priceCents: rsd(450), allergens: ['G', 'M', 'E'], photo: 'Tiramisu - Raffaele Diomede.jpg' },
    { name: sr('Čizkejk', 'Cheesecake'), description: sr('Sa šumskim voćem', 'With forest fruit'), priceCents: rsd(450), allergens: ['G', 'M', 'E'], photo: 'Baked cheesecake with raspberries and blueberries.jpg' },
    { name: sr('Sladoled', 'Ice cream'), priceCents: rsd(150), allergens: ['M'], variants: [{ name: '1 kugla', priceCents: rsd(150) }, { name: '3 kugle', priceCents: rsd(390) }], photo: 'Bowl ~ Ice cream.jpg' },
  ],
};

export const CAKES: CatalogCategory = {
  name: sr('Kolači i torte', 'Cakes & pastries'),
  items: [
    { name: sr('Krempita', 'Cream slice'), priceCents: rsd(290), allergens: ['G', 'M', 'E'], photo: 'Kremna rezina.jpg' },
    { name: sr('Šampita', 'Šampita'), description: sr('Lisnato testo i šaum', 'Puff pastry and meringue cream'), priceCents: rsd(260), allergens: ['G', 'E'], photo: 'Šampita.jpg' },
    { name: sr('Reforma torta', 'Reforma cake'), description: sr('Orasi i čokoladni krem', 'Walnuts and chocolate cream'), priceCents: rsd(390), allergens: ['G', 'M', 'E', 'N'], photo: 'Reform torta.jpg' },
    { name: sr('Vasina torta', "Vasa's cake"), description: sr('Orasi, pomorandža, čokolada', 'Walnuts, orange, chocolate'), priceCents: rsd(390), allergens: ['G', 'M', 'E', 'N'], photo: "Vasa's case - Vasina torta.jpg" },
    { name: sr('Čokoladna torta', 'Chocolate cake'), priceCents: rsd(390), allergens: ['G', 'M', 'E'], photo: 'Chocolate fudge cake.jpg' },
    { name: sr('Baklava', 'Baklava'), priceCents: rsd(250), allergens: ['G', 'N'], photo: 'Baklava displayed on a white plate.jpg' },
    { name: sr('Tufahija', 'Tufahija'), description: sr('Kuvana jabuka punjena orasima, sa šlagom', 'Poached apple stuffed with walnuts, whipped cream'), priceCents: rsd(290), allergens: ['N', 'M'], photo: 'Tufahiija in Morića Han 2.JPG' },
    { name: sr('Princes krofne', 'Cream puffs'), description: sr('3 komada', '3 pieces'), priceCents: rsd(290), allergens: ['G', 'M', 'E'], photo: 'Paris 2e - Rue Vivienne - Restaurant Le Vaudeville - Profiteroles au chocolat.jpg' },
    { name: sr('Čizkejk', 'Cheesecake'), description: sr('Sa malinama', 'With raspberries'), priceCents: rsd(420), allergens: ['G', 'M', 'E'], photo: 'Baked cheesecake with raspberries and blueberries.jpg' },
    { name: sr('Tiramisu', 'Tiramisu'), priceCents: rsd(420), allergens: ['G', 'M', 'E'], photo: 'Tiramisu - Raffaele Diomede.jpg' },
  ],
};

/** The full café drinks menu that `seed:drinks` writes. */
export const DRINK_CATEGORIES: CatalogCategory[] = [COFFEE, HOT_DRINKS, SOFT_DRINKS, FRESH_JUICES, BEER, WINE, SPIRITS, COCKTAILS];

export interface CreatedItem {
  item: MenuItem;
  photo?: string;
}

/** Appends the categories (starting at `sortOrder`) with their items and variants; returns the items for `attachPhotos()`. */
export async function insertMenu(
  restaurantId: string,
  categories: CatalogCategory[],
  sortOrder: number,
  transaction: Transaction,
): Promise<CreatedItem[]> {
  const created: CreatedItem[] = [];
  for (const category of categories) {
    const categoryRow = await Category.create(
      { restaurantId, name: category.name, sortOrder: sortOrder++, isHidden: false },
      { transaction },
    );
    for (const [index, entry] of category.items.entries()) {
      const item = await MenuItem.create(
        {
          restaurantId,
          categoryId: categoryRow.id,
          name: entry.name,
          description: entry.description ?? null,
          variantLabel: entry.variantLabel ?? null,
          priceCents: entry.priceCents,
          allergens: entry.allergens ?? [],
          tags: entry.tags ?? [],
          isAvailable: true,
          sortOrder: index,
        },
        { transaction },
      );
      if (entry.variants?.length) {
        await ItemVariant.bulkCreate(
          entry.variants.map((variant, variantIndex) => ({
            menuItemId: item.id,
            name: variant.name,
            priceCents: variant.priceCents,
            sortOrder: variantIndex,
          })),
          { transaction },
        );
      }
      created.push({ item, photo: entry.photo });
    }
  }
  return created;
}

/** Deletes every category and item of the venue; returns the stored photo URLs for `deleteStoredUrl()` after commit. */
export async function removeExistingMenu(restaurantId: string, transaction: Transaction): Promise<string[]> {
  const items = await MenuItem.findAll({ where: { restaurantId }, attributes: ['imageUrl', 'thumbnailUrl'], transaction });
  const urls = items.flatMap((item) => [item.imageUrl, item.thumbnailUrl]).filter((url): url is string => Boolean(url));
  // Variants and item views cascade; order lines keep their snapshots (menu_item_id → NULL).
  await MenuItem.destroy({ where: { restaurantId }, transaction });
  await Category.destroy({ where: { restaurantId }, transaction });
  return urls;
}

const USER_AGENT = 'otvori-seed/1.0 (https://otvori.menu; zdravo@otvori.menu)';
const PHOTO_WIDTH = 1200;
const DOWNLOAD_CONCURRENCY = 3;

function photoUrl(title: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=${PHOTO_WIDTH}`;
}

/** Processed photos by Commons title, so a photo used by several venues is downloaded and resized once per run. */
const processed = new Map<string, Promise<{ webp: Buffer; thumb: Buffer }>>();

function processedPhoto(title: string): Promise<{ webp: Buffer; thumb: Buffer }> {
  let entry = processed.get(title);
  if (!entry) {
    entry = (async () => {
      const response = await fetch(photoUrl(title), { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${title}`);
      const original = Buffer.from(await response.arrayBuffer());
      const [webp, thumb] = await Promise.all([processItemImage(original), processItemThumbnail(original)]);
      return { webp, thumb };
    })();
    entry.catch(() => processed.delete(title));
    processed.set(title, entry);
  }
  return entry;
}

async function attachPhoto(restaurantId: string, item: MenuItem, title: string): Promise<void> {
  const { webp, thumb } = await processedPhoto(title);
  const stamp = Date.now();
  const key = `restaurants/${restaurantId}/items/${item.id}-${stamp}.webp`;
  const thumbKey = `restaurants/${restaurantId}/items/${item.id}-${stamp}-thumb.webp`;
  const [imageUrl, thumbnailUrl] = await Promise.all([
    storage.put(key, webp, 'image/webp'),
    storage.put(thumbKey, thumb, 'image/webp'),
  ]);
  await item.update({ imageUrl, thumbnailUrl });
}

/**
 * Best-effort: an item whose photo cannot be fetched keeps no image. The caller bumps `touchRestaurant()` afterwards.
 */
export async function attachPhotos(restaurantId: string, created: CreatedItem[]): Promise<{ done: number; failed: number }> {
  const queue = created.filter((entry) => entry.photo);
  let done = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: DOWNLOAD_CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        try {
          await attachPhoto(restaurantId, entry.item, entry.photo!);
          done++;
        } catch (error) {
          failed++;
          logger.warn({ err: error, item: entry.item.name.sr, photo: entry.photo }, 'Photo skipped');
        }
      }
    }),
  );
  return { done, failed };
}
