import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { Op, type Transaction } from 'sequelize';
import { env } from '../config/env.js';
import { Membership, MenuItem, Promotion, Restaurant, RestaurantTable, User } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { touchRestaurant } from '../modules/shared/touch-restaurant.js';
import { processLogo } from '../utils/images.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { buildMenuUrl } from '../utils/public-url.js';
import { deleteStoredUrl, storage } from '../utils/storage.js';
import { FABRIKA_MENU } from './fabrika-menu.js';
import { FABRIKA_PROMOTIONS, type SeedPromotion } from './fabrika-promotions.js';
import { insertMenu } from './menu-catalog.js';

/**
 * Creates the real "Fabrika Kafeterija" venue with its printed menu (`fabrika-menu.ts`), its logo and the owner's
 * login, replacing any earlier venue with the same slug or name (the pilot one from `seed-venues.ts`).
 *
 *   OWNER_PASSWORD=… npm run seed:fabrika -- --logo path/to/logo.png          (dev: tsx)
 *   docker compose … exec -e OWNER_PASSWORD=… api node dist/scripts/seed-fabrika.js --logo /tmp/logo.png   (production)
 *   … seed-fabrika.js --promo-only   (keeps the live venue and its menu untouched; only upserts the promotions by title)
 *
 * The owner account is created when missing; an existing one keeps its other venues and only gets the password reset.
 * The previous venue's owner (`fabrika@otvori.menu`, from the pilot seed) is removed when no other venue is left to it.
 * Stored photos and the old logo are deleted after the transaction commits. Re-runnable.
 */

const VENUE = {
  slug: 'fabrika',
  name: 'Fabrika Kafeterija',
  tagline: 'Specialty kafa, sendviči i burgeri',
  menuNote: 'Radno vreme: svaki dan 07:30–23:00 · @fabrikakafeterija · +381 62 555 157',
  primaryColor: '#3FA6A1',
  tables: 10,
};
const OWNER = { email: 'milanjorovic@gmail.com', name: 'Milan Jorović' };
const PASSWORD = process.env.OWNER_PASSWORD ?? '';
const TRIAL_DAYS = 14;

function logoPathArg(): string | null {
  const index = process.argv.indexOf('--logo');
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

/** Deletes the venue (rows cascade) and returns its stored photo and logo URLs for `deleteStoredUrl()` after commit. */
/** Upsert the venue's seeded promotions by title (so re-running never duplicates the cocktail card). */
async function upsertPromotions(restaurantId: string, promotions: SeedPromotion[], transaction?: Transaction): Promise<void> {
  for (const [index, promo] of promotions.entries()) {
    const values = {
      title: promo.title,
      template: promo.template,
      content: promo.content,
      display: promo.display,
      accentColor: promo.accentColor ?? null,
      priority: promo.priority ?? index,
    };
    const existing = await Promotion.findOne({ where: { restaurantId, title: promo.title }, transaction });
    if (existing) await existing.update(values, { transaction });
    else await Promotion.create({ restaurantId, ...values }, { transaction });
  }
}

async function promotionsOnly(): Promise<void> {
  const restaurant = await Restaurant.findOne({ where: { slug: VENUE.slug } });
  if (!restaurant) {
    process.stderr.write(`No venue with slug "${VENUE.slug}" — run the full seeder first.\n`);
    process.exit(2);
  }
  await upsertPromotions(restaurant.id, FABRIKA_PROMOTIONS);
  process.stdout.write(`${VENUE.name}: ${FABRIKA_PROMOTIONS.length} promotion(s) upserted (${FABRIKA_PROMOTIONS.map((p) => p.title).join(', ')})\n`);
  await sequelize.close();
}

async function removeVenue(restaurant: Restaurant, transaction: Transaction): Promise<string[]> {
  const items = await MenuItem.findAll({ where: { restaurantId: restaurant.id }, attributes: ['imageUrl', 'thumbnailUrl'], transaction });
  const urls = [restaurant.logoUrl, ...items.flatMap((item) => [item.imageUrl, item.thumbnailUrl])];
  const owners = await Membership.findAll({ where: { restaurantId: restaurant.id }, attributes: ['userId'], transaction });
  await restaurant.destroy({ transaction });
  // The pilot owner account has no reason to live on without its venue (never the new owner, never a superadmin).
  for (const { userId } of owners) {
    const user = await User.findByPk(userId, { transaction });
    if (!user || user.isSuperadmin || user.email.toLowerCase() === OWNER.email) continue;
    const left = await Membership.count({ where: { userId }, transaction });
    if (left === 0) await user.destroy({ transaction });
  }
  return urls.filter((url): url is string => Boolean(url));
}

async function main(): Promise<void> {
  if (process.argv.includes('--promo-only')) {
    await promotionsOnly();
    return;
  }
  if (PASSWORD.length < 8) {
    process.stderr.write("Set OWNER_PASSWORD (at least 8 characters) to the owner's password.\n");
    process.exit(2);
  }
  const logoPath = logoPathArg();
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
    itemCount = (await insertMenu(restaurant.id, FABRIKA_MENU, 0, transaction)).length;
    await upsertPromotions(restaurant.id, FABRIKA_PROMOTIONS, transaction);
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
    `${VENUE.name}: ${FABRIKA_MENU.length} categories, ${itemCount} items, ${VENUE.tables} tables, ${FABRIKA_PROMOTIONS.length} promotion(s)` +
      `${logoPng ? ', logo uploaded' : ', no logo (--logo not given)'}${replaced ? ` (${replaced} old venue(s) replaced)` : ''}\n` +
      `Menu: ${buildMenuUrl(VENUE.slug)}\nSign in at ${env.APP_URL}: ${OWNER.email}\n`,
  );
  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed-fabrika failed');
  process.exit(1);
});
