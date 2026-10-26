import 'reflect-metadata';
import type { Transaction } from 'sequelize';
import type { Theme } from '@qr-menu/shared';
import { env } from '../config/env.js';
import { Membership, MenuItem, Restaurant, RestaurantTable, User } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { touchRestaurant } from '../modules/shared/touch-restaurant.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { buildMenuUrl } from '../utils/public-url.js';
import { deleteStoredUrl } from '../utils/storage.js';
import {
  attachPhotos,
  BAKERY,
  BEER,
  BREAKFAST,
  BURGERS,
  CAKES,
  COCKTAILS,
  COFFEE,
  DESSERTS,
  FRESH_JUICES,
  GRILL,
  HOT_DRINKS,
  insertMenu,
  PASTA,
  pick,
  PIZZA,
  priced,
  SALADS,
  SANDWICHES,
  SIDES,
  SOFT_DRINKS,
  SPIRITS,
  WINE,
  type CatalogCategory,
  type CreatedItem,
} from './menu-catalog.js';

/**
 * Creates the pilot venues (Nova Pazova / Stara Pazova), each with its own owner login, a published menu built from
 * the shared catalog (drinks only for the bars and cafés, food + drinks for the pizzeria, restaurant, sandwich bar and
 * patisserie), tables and a Commons photo per item. Every venue starts like a registration: 14-day trial, all modules off.
 *
 *   npm run seed:venues -- [slug …] [--replace] [--no-images]          (dev: tsx)
 *   docker compose exec api node dist/scripts/seed-venues.js [--replace]   (production image)
 *
 * Re-runnable: a venue whose slug already exists is skipped (the owner may have edited it). `--replace` deletes it
 * (menu, tables, orders, stored photos and logo) and creates it again; an existing owner account is kept and only its
 * password is reset to the seed password. Slugs on the command line limit the run to those venues.
 * The owners' initial password comes from `SEED_VENUES_PASSWORD` (never committed): `SEED_VENUES_PASSWORD=… npm run seed:venues`.
 */

const PASSWORD = process.env.SEED_VENUES_PASSWORD ?? '';
const TRIAL_DAYS = 14;

interface VenueDef {
  slug: string;
  name: string;
  city: string | null;
  tagline?: string;
  primaryColor: string;
  theme?: Theme;
  tables: number;
  menu: CatalogCategory[];
}

const ownerEmail = (venue: VenueDef) => `${venue.slug}@otvori.menu`;

const VENUES: VenueDef[] = [
  {
    slug: 'foka',
    name: 'Foka',
    city: 'Nova Pazova',
    tagline: 'Picerija',
    primaryColor: '#C0392B',
    tables: 14,
    menu: [
      PIZZA,
      PASTA,
      pick(SALADS, ['Šopska salata', 'Grčka salata', 'Cezar salata', 'Salata sa tunjevinom']),
      pick(DESSERTS, ['Palačinke', 'Tiramisu']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Fanta', 'Sprite', 'Ledeni čaj', 'Sok od pomorandže', 'Sok od jabuke']),
      pick(BEER, ['Jelen', 'Lav', 'Heineken', 'Točeno pivo', 'Bezalkoholno pivo']),
      pick(WINE, ['Crno vino', 'Belo vino', 'Roze vino']),
      pick(COFFEE, ['Espresso', 'Makijato', 'Kapućino', 'Domaća kafa']),
    ],
  },
  {
    slug: 'two-beers',
    name: 'Pub Two Beers',
    city: null,
    tagline: 'Pub',
    primaryColor: '#C8902E',
    theme: 'dark',
    tables: 12,
    menu: [
      priced(BEER, 1.05),
      SPIRITS,
      pick(COCKTAILS, ['Gin tonik', 'Cuba Libre', 'Mojito', 'Aperol Spritz', 'Long Island Iced Tea']),
      pick(WINE, ['Crno vino', 'Belo vino']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Fanta', 'Schweppes', 'Energetsko piće']),
      pick(COFFEE, ['Espresso', 'Domaća kafa', 'Nes kafa']),
    ],
  },
  {
    slug: 'fabrika',
    name: 'Fabrika Kafeterija',
    city: null,
    tagline: 'Sendviči, burgeri i kafa',
    primaryColor: '#3E5641',
    tables: 10,
    menu: [
      BREAKFAST,
      SANDWICHES,
      BURGERS,
      pick(SIDES, ['Pomfrit', 'Pekarski krompir']),
      pick(SALADS, ['Cezar salata', 'Grčka salata']),
      COFFEE,
      pick(HOT_DRINKS, ['Topla čokolada', 'Crni čaj', 'Čaj od nane', 'Čaj late']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Schweppes', 'Ledeni čaj', 'Sok od pomorandže']),
      FRESH_JUICES,
      pick(BEER, ['Jelen', 'Heineken', 'Craft IPA', 'Bezalkoholno pivo']),
    ],
  },
  {
    slug: 'bumerang',
    name: 'Bumerang Bar',
    city: null,
    primaryColor: '#E07A1F',
    theme: 'dark',
    tables: 10,
    menu: [
      pick(COFFEE, ['Espresso', 'Makijato', 'Kapućino', 'Domaća kafa', 'Ledena kafa', 'Frape']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Fanta', 'Sprite', 'Schweppes', 'Ledeni čaj', 'Energetsko piće']),
      pick(BEER, ['Jelen', 'Lav', 'Heineken', 'Točeno pivo', 'Pšenično pivo']),
      WINE,
      SPIRITS,
      COCKTAILS,
    ],
  },
  {
    slug: 'park',
    name: 'Park',
    city: 'Stara Pazova',
    tagline: 'Restoran · pice · paste',
    primaryColor: '#2F6B3A',
    tables: 24,
    menu: [
      pick(SALADS, ['Šopska salata', 'Grčka salata', 'Cezar salata', 'Urnebes']),
      pick(PIZZA, ['Margarita', 'Kapričoza', 'Quattro formaggi', 'Kulen', 'Pršuta', 'Vegetarijana']),
      pick(PASTA, ['Karbonara', 'Bolonjeze', 'Arabijata', 'Lazanje']),
      GRILL,
      SIDES,
      DESSERTS,
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Fanta', 'Schweppes', 'Sok od pomorandže', 'Sok od jabuke', 'Sok od višnje']),
      pick(BEER, ['Jelen', 'Lav', 'Točeno pivo', 'Tamno pivo', 'Bezalkoholno pivo']),
      WINE,
      pick(SPIRITS, ['Šljivovica', 'Dunjevača', 'Kajsijevača', 'Viski', 'Vodka']),
      pick(COFFEE, ['Espresso', 'Kapućino', 'Domaća kafa']),
    ],
  },
  {
    slug: 'mala-kafeterija',
    name: 'Mala Kafeterija',
    city: null,
    tagline: 'Kafa za poneti i za ostati',
    primaryColor: '#8C5A3C',
    tables: 6,
    menu: [
      COFFEE,
      HOT_DRINKS,
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Ledeni čaj', 'Sok od pomorandže', 'Sok od jabuke', 'Sok od borovnice']),
      FRESH_JUICES,
    ],
  },
  {
    slug: 'm38',
    name: 'M-38',
    city: null,
    primaryColor: '#5B4B8A',
    theme: 'dark',
    tables: 10,
    menu: [
      pick(COFFEE, ['Espresso', 'Dupli espresso', 'Makijato', 'Kapućino', 'Flat white', 'Ledena kafa']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Sprite', 'Schweppes', 'Ledeni čaj', 'Energetsko piće']),
      pick(FRESH_JUICES, ['Ceđena pomorandža', 'Limunada', 'Limunada sa jagodom']),
      pick(BEER, ['Jelen', 'Heineken', 'Pšenično pivo', 'Craft IPA']),
      pick(WINE, ['Belo vino', 'Roze vino', 'Prosecco']),
      pick(SPIRITS, ['Viski', "Jack Daniel's", 'Vodka', 'Tekila', 'Jägermeister', 'Campari']),
      pick(COCKTAILS, ['Aperol Spritz', 'Hugo', 'Gin tonik', 'Negroni', 'Espresso Martini', 'Mojito', 'Cosmopolitan']),
    ],
  },
  {
    slug: 'two-guns',
    name: 'Two Guns',
    city: null,
    primaryColor: '#9A6B2F',
    theme: 'dark',
    tables: 10,
    menu: [
      pick(SPIRITS, ['Viski', "Jack Daniel's", 'Tekila', 'Vodka', 'Jägermeister', 'Šljivovica', 'Baileys']),
      pick(COCKTAILS, ['Cuba Libre', 'Long Island Iced Tea', 'Margarita', 'Negroni', 'Mojito', 'Gin tonik']),
      pick(BEER, ['Jelen', 'Lav', 'Heineken', 'Točeno pivo', 'Tamno pivo', 'Craft IPA']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Schweppes', 'Energetsko piće']),
      pick(COFFEE, ['Espresso', 'Domaća kafa', 'Ledena kafa']),
    ],
  },
  {
    slug: 'stamevski',
    name: 'Stamevski',
    city: null,
    tagline: 'Kolači, doručak i kafa',
    primaryColor: '#A0522D',
    tables: 10,
    menu: [
      CAKES,
      pick(DESSERTS, ['Palačinke', 'Sladoled']),
      BAKERY,
      pick(BREAKFAST, ['Omlet', 'Kajgana sa slaninom', 'Kroasan']),
      pick(SANDWICHES, ['Sendvič šunka i sir', 'Pileći sendvič', 'Tost']),
      COFFEE,
      pick(HOT_DRINKS, ['Topla čokolada', 'Crni čaj', 'Čaj od nane', 'Kamilica', 'Voćni čaj']),
      pick(SOFT_DRINKS, ['Voda', 'Kisela voda', 'Coca-Cola', 'Ledeni čaj', 'Sok od pomorandže', 'Sok od jabuke']),
      pick(FRESH_JUICES, ['Ceđena pomorandža', 'Limunada', 'Smoothie jagoda-banana']),
    ],
  },
];

/** Deletes the venue (rows cascade) and returns its stored photo and logo URLs for `deleteStoredUrl()` after commit. */
async function removeVenue(restaurant: Restaurant, transaction: Transaction): Promise<string[]> {
  const items = await MenuItem.findAll({ where: { restaurantId: restaurant.id }, attributes: ['imageUrl', 'thumbnailUrl'], transaction });
  const urls = [restaurant.logoUrl, ...items.flatMap((item) => [item.imageUrl, item.thumbnailUrl])];
  await restaurant.destroy({ transaction });
  return urls.filter((url): url is string => Boolean(url));
}

async function seedVenue(venue: VenueDef, replace: boolean, withImages: boolean): Promise<'created' | 'skipped'> {
  const existing = await Restaurant.findOne({ where: { slug: venue.slug } });
  if (existing && !replace) return 'skipped';

  const email = ownerEmail(venue);
  const passwordHash = await hashPassword(PASSWORD);
  let created: CreatedItem[] = [];
  let staleUrls: string[] = [];
  const restaurant = await sequelize.transaction(async (transaction) => {
    if (existing) staleUrls = await removeVenue(existing, transaction);

    let owner = await User.findOne({ where: { email }, transaction });
    if (owner) await owner.update({ passwordHash }, { transaction });
    else owner = await User.create({ email, name: venue.name, passwordHash }, { transaction });

    const restaurant = await Restaurant.create(
      {
        slug: venue.slug,
        name: venue.name,
        tagline: venue.tagline ?? null,
        city: venue.city,
        primaryColor: venue.primaryColor,
        theme: venue.theme ?? 'auto',
        status: 'trial',
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        publishedAt: new Date(),
      },
      { transaction },
    );
    await Membership.create({ userId: owner.id, restaurantId: restaurant.id, role: 'owner' }, { transaction });
    await RestaurantTable.bulkCreate(
      Array.from({ length: venue.tables }, (_, index) => ({
        restaurantId: restaurant.id,
        number: index + 1,
        label: `Sto ${index + 1}`,
        sortOrder: index,
      })),
      { transaction },
    );
    created = await insertMenu(restaurant.id, venue.menu, 0, transaction);
    await touchRestaurant(restaurant.id, transaction);
    return restaurant;
  });

  for (const url of staleUrls) await deleteStoredUrl(url);

  let photos = '';
  if (withImages) {
    const { done, failed } = await attachPhotos(restaurant.id, created);
    await touchRestaurant(restaurant.id);
    photos = `, photos ${done} attached / ${failed} skipped`;
  }
  process.stdout.write(
    `${venue.slug}: ${venue.menu.length} categories, ${created.length} items, ${venue.tables} tables${photos}${existing ? ' (replaced)' : ''}\n`,
  );
  return 'created';
}

async function main(): Promise<void> {
  if (PASSWORD.length < 8) {
    process.stderr.write('Set SEED_VENUES_PASSWORD (at least 8 characters) to the owners\' initial password.\n');
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const withImages = !args.includes('--no-images');
  const only = args.filter((arg) => !arg.startsWith('--'));
  const unknown = only.filter((slug) => !VENUES.some((venue) => venue.slug === slug));
  if (unknown.length) {
    process.stderr.write(`Unknown venue slug(s): ${unknown.join(', ')}. Known: ${VENUES.map((venue) => venue.slug).join(', ')}\n`);
    process.exit(2);
  }
  const venues = only.length ? VENUES.filter((venue) => only.includes(venue.slug)) : VENUES;

  const results: { venue: VenueDef; outcome: 'created' | 'skipped' }[] = [];
  for (const venue of venues) results.push({ venue, outcome: await seedVenue(venue, replace, withImages) });

  const rows = results.map(({ venue, outcome }) => [venue.name, buildMenuUrl(venue.slug), ownerEmail(venue), outcome === 'created' ? PASSWORD : '(unchanged, skipped)']);
  const header = ['Venue', 'Menu', 'Login', 'Password'];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]!.length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column]!)).join('  ');
  process.stdout.write(`\nSign in at ${env.APP_URL}\n${line(header)}\n${line(widths.map((width) => '-'.repeat(width)))}\n${rows.map(line).join('\n')}\n`);

  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed-venues failed');
  process.exit(1);
});
