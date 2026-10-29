import {
  ALLERGENS,
  MENU_IMPORT_COLUMNS,
  MENU_IMPORT_LIMITS,
  TAGS,
  menuImportRowSchema,
  type CopyMenuResultDto,
  type MenuImportColumn,
  type MenuImportInput,
  type MenuImportPreviewDto,
  type MenuImportPreviewRowDto,
  type MenuImportResultDto,
  type MenuImportRow,
} from '@qr-menu/shared';
import { Category, ItemVariant, MenuItem, Restaurant } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { AppError, notFound } from '../../utils/errors.js';
import { parseCsv, readXlsx, toCsv, writeXlsx } from '../../utils/xlsx.js';
import * as audit from '../audit/service.js';
import { touchRestaurant } from '../shared/touch-restaurant.js';

/* ------------------------------------------------------------------ template */

const TEMPLATE_HEADER = [...MENU_IMPORT_COLUMNS];
const TEMPLATE_ROWS: (string | number)[][] = [
  ['Kafa', 'Espresso', 'Espresso', 'Zrna iz Etiopije', 'Ethiopian beans', 180, '', ''],
  ['Kafa', 'Kapućino', 'Cappuccino', '', '', 250, 'M', 'new'],
  ['Doručak', 'Tost sa avokadom', 'Avocado toast', 'Sa čeri paradajzom', 'With cherry tomatoes', 650, 'G,Se', 'vegan'],
  ['Doručak', 'Omlet', 'Omelette', '', '', 520, 'E,M', ''],
];
const COLUMN_WIDTHS = [18, 28, 28, 36, 36, 10, 14, 14];

export function templateCsv(): string {
  return toCsv([TEMPLATE_HEADER, ...TEMPLATE_ROWS]);
}

export function templateXlsx(): Buffer {
  return writeXlsx([TEMPLATE_HEADER, ...TEMPLATE_ROWS], 'Meni', COLUMN_WIDTHS);
}

/* ------------------------------------------------------------------ parsing */

/** Header aliases (case-insensitive, trimmed): Serbian and English spellings of the template columns. */
const HEADER_ALIASES: Record<string, MenuImportColumn> = {
  category: 'category', kategorija: 'category', grupa: 'category',
  name_sr: 'name_sr', naziv: 'name_sr', naziv_sr: 'name_sr', name: 'name_sr', ime: 'name_sr',
  name_en: 'name_en', naziv_en: 'name_en', 'name (en)': 'name_en',
  description_sr: 'description_sr', opis: 'description_sr', opis_sr: 'description_sr', description: 'description_sr',
  description_en: 'description_en', opis_en: 'description_en',
  price: 'price', cena: 'price', 'price (rsd)': 'price', 'cena (rsd)': 'price',
  allergens: 'allergens', alergeni: 'allergens',
  tags: 'tags', oznake: 'tags', tagovi: 'tags',
};

const ALLERGEN_ALIASES: Record<string, string> = Object.fromEntries([
  ...ALLERGENS.map((a) => [a.toLowerCase(), a] as const),
  ['gluten', 'G'], ['mleko', 'M'], ['milk', 'M'], ['jaja', 'E'], ['egg', 'E'], ['eggs', 'E'], ['orasi', 'N'], ['nuts', 'N'], ['orašasti', 'N'],
  ['soja', 'S'], ['soy', 'S'], ['riba', 'F'], ['fish', 'F'], ['celer', 'C'], ['celery', 'C'], ['susam', 'Se'], ['sesame', 'Se'],
]);
const TAG_ALIASES: Record<string, string> = Object.fromEntries([
  ...TAGS.map((t) => [t, t] as const),
  ['vegansko', 'vegan'], ['ljuto', 'spicy'], ['novo', 'new'],
]);

export interface ParsedSheet {
  rows: string[][];
}

/** CSV or XLSX by sniffing the bytes (zip magic), not the file name. */
export function parseSheet(buffer: Buffer): string[][] {
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return readXlsx(buffer);
  return parseCsv(buffer.toString('utf8'));
}

/** "1.290,50" / "1290.5" / "1 290" → minor units; null when not a price. */
export function parsePrice(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '').replace(/rsd$/i, '').replace(/din\.?$/i, '');
  if (text === '') return null;
  // Both separators: the last one is the decimal mark.
  let normalized = text;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // "1,290" is a thousands group only when exactly 3 digits follow and there is no other comma.
    const after = text.length - lastComma - 1;
    normalized = after === 3 && text.indexOf(',') === lastComma && text.length > 4 ? text.replace(',', '') : text.replace(',', '.');
  } else if (lastDot >= 0) {
    const after = text.length - lastDot - 1;
    normalized = after === 3 && text.indexOf('.') === lastDot && text.length > 4 ? text.replace('.', '') : text;
  }
  const major = Number(normalized);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface PreviewOptions {
  existingCategoryNames: string[];
}

/** Turns a parsed sheet into the preview: one row per data line with its errors; invalid rows keep their values. */
export function previewRows(sheet: string[][], options: PreviewOptions): MenuImportPreviewDto {
  if (sheet.length === 0) throw new AppError(400, 'IMPORT_INVALID', 'The file is empty');
  const header = sheet[0]!.map((h) => h.trim().toLowerCase());
  const columns = new Map<MenuImportColumn, number>();
  const unknown: string[] = [];
  header.forEach((name, index) => {
    const column = HEADER_ALIASES[name];
    if (column && !columns.has(column)) columns.set(column, index);
    else if (name) unknown.push(sheet[0]![index]!);
  });
  const required: MenuImportColumn[] = ['category', 'name_sr', 'price'];
  const missing = required.filter((c) => !columns.has(c));
  if (missing.length) {
    throw new AppError(400, 'IMPORT_INVALID', `Missing columns: ${missing.join(', ')}. Use the template (first row = column names).`, { missing, header: sheet[0] });
  }
  const dataRows = sheet.slice(1, 1 + MENU_IMPORT_LIMITS.maxRows);
  if (sheet.length - 1 > MENU_IMPORT_LIMITS.maxRows) {
    throw new AppError(400, 'IMPORT_INVALID', `At most ${MENU_IMPORT_LIMITS.maxRows} rows per import (the file has ${sheet.length - 1})`);
  }
  const cell = (row: string[], column: MenuImportColumn) => (columns.has(column) ? (row[columns.get(column)!] ?? '').trim() : '');
  const existing = new Set(options.existingCategoryNames.map((n) => n.trim().toLowerCase()));
  const categories: string[] = [];
  const rows: MenuImportPreviewRowDto[] = dataRows.map((raw, index) => {
    const errors: string[] = [];
    const category = cell(raw, 'category');
    const nameSr = cell(raw, 'name_sr');
    const nameEn = cell(raw, 'name_en');
    const descSr = cell(raw, 'description_sr');
    const descEn = cell(raw, 'description_en');
    const priceText = cell(raw, 'price');
    const priceCents = parsePrice(priceText);
    if (!category) errors.push('Category is missing');
    else if (category.length > 100) errors.push('Category name is longer than 100 characters');
    if (!nameSr && !nameEn) errors.push('Name is missing');
    if (nameSr.length > 500 || nameEn.length > 500) errors.push('Name is longer than 500 characters');
    if (priceText === '') errors.push('Price is missing');
    else if (priceCents === null) errors.push(`“${priceText}” is not a price`);
    const allergens: string[] = [];
    for (const token of splitList(cell(raw, 'allergens'))) {
      const mapped = ALLERGEN_ALIASES[token.toLowerCase()];
      if (mapped) allergens.push(mapped);
      else errors.push(`Unknown allergen “${token}” (use ${ALLERGENS.join(', ')})`);
    }
    const tags: string[] = [];
    for (const token of splitList(cell(raw, 'tags'))) {
      const mapped = TAG_ALIASES[token.toLowerCase()];
      if (mapped) tags.push(mapped);
      else errors.push(`Unknown tag “${token}” (use ${TAGS.join(', ')})`);
    }
    if (category && !categories.some((c) => c.toLowerCase() === category.toLowerCase())) categories.push(category);
    const name = { ...(nameSr ? { sr: nameSr } : {}), ...(nameEn ? { en: nameEn } : {}) };
    const description = descSr || descEn ? { ...(descSr ? { sr: descSr } : {}), ...(descEn ? { en: descEn } : {}) } : null;
    return { line: index + 2, category, name, description, priceCents, allergens: [...new Set(allergens)], tags: [...new Set(tags)], errors };
  });
  const valid = rows.filter((r) => r.errors.length === 0).length;
  return {
    rows,
    valid,
    invalid: rows.length - valid,
    categories,
    existingCategories: categories.filter((c) => existing.has(c.toLowerCase())),
    unknownColumns: unknown,
  };
}

/* ------------------------------------------------------------------ preview + import against a venue */

async function categoryNames(restaurantId: string): Promise<{ id: string; names: string[] }[]> {
  const categories = await Category.findAll({ where: { restaurantId }, attributes: ['id', 'name'] });
  return categories.map((c) => ({ id: c.id, names: Object.values(c.name ?? {}).filter((v): v is string => typeof v === 'string' && v.length > 0) }));
}

export async function previewImport(restaurantId: string, file: Buffer): Promise<MenuImportPreviewDto> {
  if (file.length > MENU_IMPORT_LIMITS.maxFileBytes) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'The file is larger than 2 MB');
  let sheet: string[][];
  try {
    sheet = parseSheet(file);
  } catch (error) {
    throw new AppError(400, 'IMPORT_INVALID', `Could not read the file as CSV or XLSX (${error instanceof Error ? error.message : 'unknown error'})`);
  }
  const existing = await categoryNames(restaurantId);
  return previewRows(sheet, { existingCategoryNames: existing.flatMap((c) => c.names) });
}

/** Creates categories (by name, any language, case-insensitive) and items; existing categories are merged or skipped. */
export async function importMenu(restaurantId: string, input: MenuImportInput): Promise<MenuImportResultDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'defaultLocale'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  const rows: MenuImportRow[] = input.rows.map((row) => menuImportRowSchema.parse(row));
  const result = await sequelize.transaction(async (transaction) => {
    const existing = await categoryNames(restaurantId);
    const byName = new Map<string, string>();
    for (const c of existing) for (const n of c.names) byName.set(n.toLowerCase(), c.id);
    let sortOrder = ((await Category.max<number, Category>('sortOrder', { where: { restaurantId }, transaction })) ?? -1) + 1;
    const itemSort = new Map<string, number>();
    let categoriesCreated = 0;
    let itemsCreated = 0;
    let rowsSkipped = 0;
    const reused = new Set<string>();
    for (const row of rows) {
      const key = row.category.trim().toLowerCase();
      let categoryId = byName.get(key);
      if (categoryId && input.existing === 'skip' && existing.some((c) => c.id === categoryId)) {
        rowsSkipped += 1;
        continue;
      }
      if (!categoryId) {
        const locale = restaurant.defaultLocale === 'en' ? 'en' : 'sr';
        const category = await Category.create({ restaurantId, name: { [locale]: row.category.trim() }, isHidden: false, sortOrder: sortOrder++ }, { transaction });
        categoryId = category.id;
        byName.set(key, categoryId);
        categoriesCreated += 1;
      } else if (existing.some((c) => c.id === categoryId)) {
        reused.add(categoryId);
      }
      if (!itemSort.has(categoryId)) {
        const max = (await MenuItem.max<number, MenuItem>('sortOrder', { where: { restaurantId, categoryId }, transaction })) ?? -1;
        itemSort.set(categoryId, max + 1);
      }
      const next = itemSort.get(categoryId)!;
      itemSort.set(categoryId, next + 1);
      await MenuItem.create(
        {
          restaurantId,
          categoryId,
          name: row.name,
          description: row.description && Object.keys(row.description).length ? row.description : null,
          priceCents: row.priceCents,
          allergens: row.allergens,
          tags: row.tags,
          isAvailable: true,
          sortOrder: next,
        },
        { transaction },
      );
      itemsCreated += 1;
    }
    await touchRestaurant(restaurantId, transaction);
    return { categoriesCreated, categoriesReused: reused.size, itemsCreated, rowsSkipped };
  });
  await audit.record({ restaurantId, action: 'menu.import', entity: { type: 'menu' }, after: { ...result, rows: rows.length } });
  return result;
}

/* ------------------------------------------------------------------ copy from another venue (superadmin) */

/**
 * Deep-copies categories, items and variants (no images, no POS codes, everything available) from `sourceId`
 * into `restaurantId`, appended after whatever the target already has.
 */
export async function copyMenu(restaurantId: string, sourceId: string): Promise<CopyMenuResultDto> {
  if (restaurantId === sourceId) throw new AppError(400, 'VALIDATION_ERROR', 'Pick a different venue to copy from');
  const [target, source] = await Promise.all([Restaurant.findByPk(restaurantId, { attributes: ['id', 'name'] }), Restaurant.findByPk(sourceId, { attributes: ['id', 'name'] })]);
  if (!target) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  if (!source) throw notFound('Source venue not found', 'RESTAURANT_NOT_FOUND');
  const result = await sequelize.transaction(async (transaction) => {
    const categories = await Category.findAll({ where: { restaurantId: sourceId }, order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']], transaction });
    const items = await MenuItem.findAll({
      where: { restaurantId: sourceId },
      include: [{ model: ItemVariant, as: 'variants' }],
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
      transaction,
    });
    let sortOrder = ((await Category.max<number, Category>('sortOrder', { where: { restaurantId }, transaction })) ?? -1) + 1;
    const categoryMap = new Map<string, string>();
    for (const category of categories) {
      const created = await Category.create({ restaurantId, name: category.name, isHidden: category.isHidden, sortOrder: sortOrder++ }, { transaction });
      categoryMap.set(category.id, created.id);
    }
    let variants = 0;
    for (const item of items) {
      const categoryId = categoryMap.get(item.categoryId);
      if (!categoryId) continue;
      const created = await MenuItem.create(
        {
          restaurantId,
          categoryId,
          name: item.name,
          description: item.description,
          variantLabel: item.variantLabel ?? null,
          priceCents: item.priceCents,
          allergens: item.allergens,
          tags: item.tags,
          isAvailable: true,
          unavailableUntil: null,
          sortOrder: item.sortOrder,
          posProductCode: null,
        },
        { transaction },
      );
      const list = [...(item.variants ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      if (list.length) {
        await ItemVariant.bulkCreate(list.map((v) => ({ menuItemId: created.id, name: v.name, priceCents: v.priceCents, sortOrder: v.sortOrder })), { transaction });
        variants += list.length;
      }
    }
    await touchRestaurant(restaurantId, transaction);
    return { categories: categories.length, items: items.length, variants };
  });
  await audit.record({ restaurantId, action: 'menu.copy', entity: { type: 'restaurant', id: source.id, label: source.name }, after: result });
  return result;
}
