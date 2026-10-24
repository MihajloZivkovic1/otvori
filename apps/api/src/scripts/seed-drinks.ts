import 'reflect-metadata';
import type { Transaction } from 'sequelize';
import type { TranslatedText } from '@qr-menu/shared';
import { Category, ItemVariant, MenuItem, Restaurant } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { touchRestaurant } from '../modules/shared/touch-restaurant.js';
import { processItemImage, processItemThumbnail } from '../utils/images.js';
import { logger } from '../utils/logger.js';
import { deleteStoredUrl, storage } from '../utils/storage.js';

/**
 * Fills an existing venue with a realistic café drinks menu (≈ 70 items in 8 categories, sr + en, variants)
 * and a photo per item taken from Wikimedia Commons, processed exactly like a CMS upload (800×800 WebP +
 * 160×160 thumbnail, stored through the configured storage driver).
 *
 *   npm run seed:drinks -- <slug> [--replace] [--no-images]        (dev: tsx)
 *   docker compose exec api node dist/scripts/seed-drinks.js <slug> --replace   (production image)
 *
 * Without `--replace` the categories are appended after the venue's existing ones; with it every existing
 * category, item, variant and stored photo of the venue is removed first (orders keep their snapshots).
 * Photo downloads are best-effort: an item whose photo cannot be fetched is still created, without an image.
 */

interface DrinkVariant {
  name: string;
  priceCents: number;
}
interface Drink {
  name: TranslatedText;
  description?: TranslatedText;
  /** Minor units (RSD × 100). */
  priceCents: number;
  allergens?: string[];
  tags?: string[];
  variants?: DrinkVariant[];
  /** Wikimedia Commons file title (without the "File:" prefix). */
  photo?: string;
}
interface DrinkCategory {
  name: TranslatedText;
  items: Drink[];
}

const rsd = (amount: number) => Math.round(amount * 100);
const sr = (sr: string, en: string): TranslatedText => ({ sr, en });

const CATEGORIES: DrinkCategory[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
    name: sr('Sveže ceđeno i smoothie', 'Fresh juices & smoothies'),
    items: [
      { name: sr('Ceđena pomorandža', 'Fresh orange juice'), description: sr('0,3 l, ceđeno pred vama', '0.3 l, squeezed in front of you'), priceCents: rsd(390), tags: ['vegan'], photo: 'Fresh orange juice.jpg' },
      { name: sr('Limunada', 'Lemonade'), description: sr('Limun, nana, led', 'Lemon, mint, ice'), priceCents: rsd(300), tags: ['vegan'], photo: 'Glass of lemonade.jpg' },
      { name: sr('Limunada sa jagodom', 'Strawberry lemonade'), description: sr('Domaća limunada sa svežim jagodama', 'Homemade lemonade with fresh strawberries'), priceCents: rsd(350), tags: ['vegan', 'new'], photo: 'Lemonade with strawberry.jpg' },
      { name: sr('Sok od jagode', 'Fresh strawberry juice'), description: sr('0,3 l, sveže voće', '0.3 l, fresh fruit'), priceCents: rsd(390), tags: ['vegan'], photo: 'Glass of strawberry juice 20180815.jpg' },
      { name: sr('Smoothie jagoda-banana', 'Strawberry banana smoothie'), description: sr('Sa jogurtom i medom', 'With yoghurt and honey'), priceCents: rsd(420), allergens: ['M'], photo: 'Strawberry smoothie.jpg' },
      { name: sr('Zeleni smoothie', 'Green smoothie'), description: sr('Spanać, jabuka, krastavac, limun', 'Spinach, apple, cucumber, lemon'), priceCents: rsd(420), tags: ['vegan'], photo: 'Green smoothie.jpg' },
    ],
  },
  {
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
  },
  {
    name: sr('Vino', 'Wine'),
    items: [
      { name: sr('Crno vino', 'Red wine'), description: sr('Prokupac, Župa', 'Prokupac, Župa'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Wine being poured into a glass.jpg' },
      { name: sr('Belo vino', 'White wine'), description: sr('Tamjanika, Oplenac', 'Tamjanika, Oplenac'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Glass of white wine.jpg' },
      { name: sr('Roze vino', 'Rosé wine'), description: sr('Fruška gora', 'Fruška gora'), priceCents: rsd(350), allergens: ['S'], variants: [{ name: 'Čaša 0,15 l', priceCents: rsd(350) }, { name: 'Flaša 0,75 l', priceCents: rsd(1800) }], photo: 'Rose wine.jpg' },
      { name: sr('Prosecco', 'Prosecco'), description: sr('DOC, Italija', 'DOC, Italy'), priceCents: rsd(450), allergens: ['S'], variants: [{ name: 'Čaša 0,1 l', priceCents: rsd(450) }, { name: 'Flaša 0,75 l', priceCents: rsd(2400) }], photo: 'Prosecco di Conegliano bottle and glass.jpg' },
    ],
  },
  {
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
  },
  {
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
  },
];

const USER_AGENT = 'otvori-seed/1.0 (https://otvori.menu; zdravo@otvori.menu)';
const PHOTO_WIDTH = 1200;
const DOWNLOAD_CONCURRENCY = 3;

function photoUrl(title: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=${PHOTO_WIDTH}`;
}

async function downloadPhoto(title: string): Promise<Buffer> {
  const response = await fetch(photoUrl(title), { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${title}`);
  return Buffer.from(await response.arrayBuffer());
}

async function attachPhoto(restaurantId: string, item: MenuItem, title: string): Promise<void> {
  const original = await downloadPhoto(title);
  const [webp, thumb] = await Promise.all([processItemImage(original), processItemThumbnail(original)]);
  const stamp = Date.now();
  const key = `restaurants/${restaurantId}/items/${item.id}-${stamp}.webp`;
  const thumbKey = `restaurants/${restaurantId}/items/${item.id}-${stamp}-thumb.webp`;
  const [imageUrl, thumbnailUrl] = await Promise.all([
    storage.put(key, webp, 'image/webp'),
    storage.put(thumbKey, thumb, 'image/webp'),
  ]);
  await item.update({ imageUrl, thumbnailUrl });
}

async function removeExistingMenu(restaurantId: string, transaction: Transaction): Promise<string[]> {
  const items = await MenuItem.findAll({ where: { restaurantId }, attributes: ['imageUrl', 'thumbnailUrl'], transaction });
  const urls = items.flatMap((item) => [item.imageUrl, item.thumbnailUrl]).filter((url): url is string => Boolean(url));
  // Variants and item views cascade; order lines keep their snapshots (menu_item_id → NULL).
  await MenuItem.destroy({ where: { restaurantId }, transaction });
  await Category.destroy({ where: { restaurantId }, transaction });
  return urls;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slug = args.find((arg) => !arg.startsWith('--'));
  const replace = args.includes('--replace');
  const withImages = !args.includes('--no-images');
  if (!slug) {
    process.stderr.write('Usage: seed-drinks <restaurant slug> [--replace] [--no-images]\n');
    process.exit(2);
  }

  const restaurant = await Restaurant.findOne({ where: { slug } });
  if (!restaurant) {
    process.stderr.write(`No restaurant with slug "${slug}".\n`);
    process.exit(1);
  }

  const created: { item: MenuItem; photo?: string }[] = [];
  let staleUrls: string[] = [];
  await sequelize.transaction(async (transaction) => {
    let sortOrder = 0;
    if (replace) {
      staleUrls = await removeExistingMenu(restaurant.id, transaction);
    } else {
      const last = await Category.max<number | null, Category>('sortOrder', { where: { restaurantId: restaurant.id }, transaction });
      sortOrder = (last ?? -1) + 1;
    }
    for (const category of CATEGORIES) {
      const categoryRow = await Category.create(
        { restaurantId: restaurant.id, name: category.name, sortOrder: sortOrder++, isHidden: false },
        { transaction },
      );
      for (const [index, drink] of category.items.entries()) {
        const item = await MenuItem.create(
          {
            restaurantId: restaurant.id,
            categoryId: categoryRow.id,
            name: drink.name,
            description: drink.description ?? null,
            priceCents: drink.priceCents,
            allergens: drink.allergens ?? [],
            tags: drink.tags ?? [],
            isAvailable: true,
            sortOrder: index,
          },
          { transaction },
        );
        if (drink.variants?.length) {
          await ItemVariant.bulkCreate(
            drink.variants.map((variant, variantIndex) => ({
              menuItemId: item.id,
              name: variant.name,
              priceCents: variant.priceCents,
              sortOrder: variantIndex,
            })),
            { transaction },
          );
        }
        created.push({ item, photo: drink.photo });
      }
    }
    await touchRestaurant(restaurant.id, transaction);
  });
  process.stdout.write(`${slug}: created ${CATEGORIES.length} categories and ${created.length} items${replace ? ' (previous menu removed)' : ''}.\n`);

  for (const url of staleUrls) await deleteStoredUrl(url);

  if (withImages) {
    const queue = created.filter((entry) => entry.photo);
    let done = 0;
    let failed = 0;
    await Promise.all(
      Array.from({ length: DOWNLOAD_CONCURRENCY }, async () => {
        for (let entry = queue.shift(); entry; entry = queue.shift()) {
          try {
            await attachPhoto(restaurant.id, entry.item, entry.photo!);
            done++;
          } catch (error) {
            failed++;
            logger.warn({ err: error, item: entry.item.name.sr, photo: entry.photo }, 'Photo skipped');
          }
        }
      }),
    );
    await touchRestaurant(restaurant.id);
    process.stdout.write(`Photos: ${done} attached, ${failed} skipped.\n`);
  }

  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed-drinks failed');
  process.exit(1);
});
