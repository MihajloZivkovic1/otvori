import 'reflect-metadata';
import { Category, Restaurant } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { touchRestaurant } from '../modules/shared/touch-restaurant.js';
import { logger } from '../utils/logger.js';
import { deleteStoredUrl } from '../utils/storage.js';
import { attachPhotos, DRINK_CATEGORIES, insertMenu, removeExistingMenu, type CreatedItem } from './menu-catalog.js';

/**
 * Fills an existing venue with a realistic café drinks menu (≈ 70 items in 8 categories, sr + en, variants)
 * and a photo per item taken from Wikimedia Commons, processed exactly like a CMS upload (800×800 WebP +
 * 160×160 thumbnail, stored through the configured storage driver). The catalog lives in `menu-catalog.ts`.
 *
 *   npm run seed:drinks -- <slug> [--replace] [--no-images]        (dev: tsx)
 *   docker compose exec api node dist/scripts/seed-drinks.js <slug> --replace   (production image)
 *
 * Without `--replace` the categories are appended after the venue's existing ones; with it every existing
 * category, item, variant and stored photo of the venue is removed first (orders keep their snapshots).
 * Photo downloads are best-effort: an item whose photo cannot be fetched is still created, without an image.
 */

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

  let created: CreatedItem[] = [];
  let staleUrls: string[] = [];
  await sequelize.transaction(async (transaction) => {
    let sortOrder = 0;
    if (replace) {
      staleUrls = await removeExistingMenu(restaurant.id, transaction);
    } else {
      const last = await Category.max<number | null, Category>('sortOrder', { where: { restaurantId: restaurant.id }, transaction });
      sortOrder = (last ?? -1) + 1;
    }
    created = await insertMenu(restaurant.id, DRINK_CATEGORIES, sortOrder, transaction);
    await touchRestaurant(restaurant.id, transaction);
  });
  process.stdout.write(`${slug}: created ${DRINK_CATEGORIES.length} categories and ${created.length} items${replace ? ' (previous menu removed)' : ''}.\n`);

  for (const url of staleUrls) await deleteStoredUrl(url);

  if (withImages) {
    const { done, failed } = await attachPhotos(restaurant.id, created);
    await touchRestaurant(restaurant.id);
    process.stdout.write(`Photos: ${done} attached, ${failed} skipped.\n`);
  }

  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed-drinks failed');
  process.exit(1);
});
