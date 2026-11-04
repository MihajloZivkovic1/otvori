import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Op, type Transaction } from 'sequelize';
import { env } from '../config/env.js';
import { Membership, MenuItem, Restaurant, RestaurantTable, User } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { touchRestaurant } from '../modules/shared/touch-restaurant.js';
import { processLogo } from '../utils/images.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { buildMenuUrl } from '../utils/public-url.js';
import { deleteStoredUrl, storage } from '../utils/storage.js';
import { LIVING_ROOM_MENU } from './living-room-menu.js';
import { insertMenu, syncMenu } from './menu-catalog.js';

/**
 * Creates the real "Living Room 21" venue (Beogradska 21, Vračar) with its printed menu (`living-room-menu.ts`), the
 * arch mark from the venue's logo (`assets/living-room-21/logo.png`, cut out of the PDF the owner sent) and the owner's
 * login, replacing any earlier venue with the same slug or name. No mail is sent: the owner gets the credentials by hand.
 *
 *   OWNER_PASSWORD=… npm run seed:living-room -w @qr-menu/api                                  (dev: tsx)
 *   docker compose … exec -e OWNER_PASSWORD=… api node dist/scripts/seed-living-room.js         (production)
 *   … --logo path/to/other.png        (another logo file instead of the bundled mark; --no-logo skips it)
 *   … --sync-menu [--category Dezerti] (keeps the live venue; writes the seed's text, prices, variants, allergens and
 *                                       tags into the items with the same Serbian name, creates the missing ones, deletes nothing)
 *
 * The owner account is created when missing; an existing one keeps its other venues and only gets the password reset.
 * The previous venue's logo and photos are deleted from storage after the transaction commits. Re-runnable.
 */

const VENUE = {
  slug: 'living-room-21',
  name: 'Living Room 21',
  tagline: 'Kafa, doručak i kuhinja na Vračaru',
  menuNote: 'Doručak se služi do 13:00h · Wifi: Livingroom · Pass: livingroom2025 · @living.room.21',
  /** The copper of the line-art logo (the wordmark's green #405038 is too dark for chips). */
  primaryColor: '#B05810',
  address: 'Beogradska 21',
  city: 'Beograd',
  tables: 10,
};
const OWNER = { email: 'living.room.beograd@gmail.com', name: 'Living Room' };
const PASSWORD = process.env.OWNER_PASSWORD ?? '';
const TRIAL_DAYS = 14;
const LOGO_PATH = fileURLToPath(new URL('../../assets/living-room-21/logo.png', import.meta.url));

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function syncMenuOnly(): Promise<void> {
  const restaurant = await Restaurant.findOne({ where: { slug: VENUE.slug } });
  if (!restaurant) {
    process.stderr.write(`No venue with slug "${VENUE.slug}" — run the full seeder first.\n`);
    process.exit(2);
  }
  const only = argValue('--category');
  const categories = only ? LIVING_ROOM_MENU.filter((category) => category.name.sr === only) : LIVING_ROOM_MENU;
  if (only && categories.length === 0) {
    process.stderr.write(`No category "${only}" in the seed (${LIVING_ROOM_MENU.map((c) => c.name.sr).join(', ')}).\n`);
    process.exit(2);
  }
  const { updated, created, categoriesCreated } = await sequelize.transaction((transaction) => syncMenu(restaurant.id, categories, transaction));
  process.stdout.write(
    `${VENUE.name}: ${updated} item(s) updated, ${created} created, ${categoriesCreated} categor${categoriesCreated === 1 ? 'y' : 'ies'} created` +
      `${only ? ` (category "${only}")` : ''}\n`,
  );
  await sequelize.close();
}

/** Deletes the venue (rows cascade) and returns its stored photo and logo URLs for `deleteStoredUrl()` after commit. */
async function removeVenue(restaurant: Restaurant, transaction: Transaction): Promise<string[]> {
  const items = await MenuItem.findAll({ where: { restaurantId: restaurant.id }, attributes: ['imageUrl', 'thumbnailUrl'], transaction });
  const urls = [restaurant.logoUrl, ...items.flatMap((item) => [item.imageUrl, item.thumbnailUrl])];
  await restaurant.destroy({ transaction });
  return urls.filter((url): url is string => Boolean(url));
}

async function main(): Promise<void> {
  if (process.argv.includes('--sync-menu')) {
    await syncMenuOnly();
    return;
  }
  if (PASSWORD.length < 8) {
    process.stderr.write("Set OWNER_PASSWORD (at least 8 characters) to the owner's password.\n");
    process.exit(2);
  }
  const logoPath = process.argv.includes('--no-logo') ? null : (argValue('--logo') ?? LOGO_PATH);
  const logoPng = logoPath ? await processLogo(await readFile(logoPath)) : null;
  const passwordHash = await hashPassword(PASSWORD);

  const staleUrls: string[] = [];
  let replaced = 0;
  let itemCount = 0;
  const restaurant = await sequelize.transaction(async (transaction) => {
    const previous = await Restaurant.findAll({
      where: { [Op.or]: [{ slug: VENUE.slug }, { name: { [Op.iLike]: VENUE.name } }] },
      transaction,
    });
    for (const old of previous) staleUrls.push(...(await removeVenue(old, transaction)));
    replaced = previous.length;

    let owner = await User.findOne({ where: { email: OWNER.email }, transaction });
    if (owner) await owner.update({ passwordHash, name: owner.name || OWNER.name }, { transaction });
    else owner = await User.create({ email: OWNER.email, name: OWNER.name, passwordHash }, { transaction });

    const restaurant = await Restaurant.create(
      {
        slug: VENUE.slug,
        name: VENUE.name,
        tagline: VENUE.tagline,
        menuNote: VENUE.menuNote,
        primaryColor: VENUE.primaryColor,
        address: VENUE.address,
        city: VENUE.city,
        theme: 'auto',
        status: 'trial',
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        publishedAt: new Date(),
      },
      { transaction },
    );
    await Membership.create({ userId: owner.id, restaurantId: restaurant.id, role: 'owner' }, { transaction });
    await RestaurantTable.bulkCreate(
      Array.from({ length: VENUE.tables }, (_, index) => ({
        restaurantId: restaurant.id,
        number: index + 1,
        label: `Sto ${index + 1}`,
        sortOrder: index,
      })),
      { transaction },
    );
    itemCount = (await insertMenu(restaurant.id, LIVING_ROOM_MENU, 0, transaction)).length;
    await touchRestaurant(restaurant.id, transaction);
    return restaurant;
  });

  for (const url of staleUrls) await deleteStoredUrl(url);

  if (logoPng) {
    const url = await storage.put(`restaurants/${restaurant.id}/logo-${Date.now()}.png`, logoPng, 'image/png');
    await restaurant.update({ logoUrl: url });
    await touchRestaurant(restaurant.id);
  }

  process.stdout.write(
    `${VENUE.name}: ${LIVING_ROOM_MENU.length} categories, ${itemCount} items, ${VENUE.tables} tables` +
      `${logoPng ? ', logo uploaded' : ', no logo'}${replaced ? ` (${replaced} old venue(s) replaced)` : ''}\n` +
      `Menu: ${buildMenuUrl(VENUE.slug)}\nSign in at ${env.APP_URL}: ${OWNER.email}\n`,
  );
  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed-living-room failed');
  process.exit(1);
});
