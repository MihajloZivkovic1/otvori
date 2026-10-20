import { literal, type FindAttributeOptions, type Order } from 'sequelize';
import type { CreateTableInput, TableDto, UpdateTableInput } from '@qr-menu/shared';
import { Restaurant, RestaurantTable } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { conflict, notFound } from '../../utils/errors.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import { storage } from '../../utils/storage.js';
import { applySortOrder } from '../shared/sort-order.js';
import { touchRestaurant } from '../shared/touch-restaurant.js';
import { qrPng, qrSvg, renderQrSheet } from './qr.js';

const SCANS_LAST_7_DAYS = literal(
  `(SELECT COUNT(*) FROM scan_events se WHERE se.table_id = "RestaurantTable"."id" AND se.scanned_at >= now() - interval '7 days')`,
);
const LAST_SCAN_AT = literal(`(SELECT MAX(se.scanned_at) FROM scan_events se WHERE se.table_id = "RestaurantTable"."id")`);

const TABLE_ATTRIBUTES: FindAttributeOptions = {
  include: [
    [SCANS_LAST_7_DAYS, 'scansLast7Days'],
    [LAST_SCAN_AT, 'lastScanAt'],
  ],
};

const TABLE_ORDER: Order = [
  ['sortOrder', 'ASC'],
  ['number', 'ASC'],
];

function toTableDto(table: RestaurantTable, slug: string): TableDto {
  const lastScan = table.get('lastScanAt') as Date | string | null | undefined;
  return {
    id: table.id,
    restaurantId: table.restaurantId,
    number: table.number,
    label: table.label,
    sortOrder: table.sortOrder,
    menuUrl: buildMenuUrl(slug, table.number),
    scansLast7Days: Number(table.get('scansLast7Days') ?? 0),
    lastScanAt: lastScan ? toIso(new Date(lastScan)) : null,
    createdAt: table.createdAt.toISOString(),
  };
}

async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId);
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

async function loadTable(restaurantId: string, tableId: string): Promise<RestaurantTable> {
  const table = await RestaurantTable.findOne({
    where: { id: tableId, restaurantId },
    attributes: TABLE_ATTRIBUTES,
  });
  if (!table) throw notFound('Table not found');
  return table;
}

export async function listTables(restaurantId: string): Promise<TableDto[]> {
  const [restaurant, tables] = await Promise.all([
    loadRestaurant(restaurantId),
    RestaurantTable.findAll({ where: { restaurantId }, attributes: TABLE_ATTRIBUTES, order: TABLE_ORDER }),
  ]);
  return tables.map((table) => toTableDto(table, restaurant.slug));
}

export async function getTable(restaurantId: string, tableId: string): Promise<TableDto> {
  const [restaurant, table] = await Promise.all([loadRestaurant(restaurantId), loadTable(restaurantId, tableId)]);
  return toTableDto(table, restaurant.slug);
}

async function assertNumberFree(restaurantId: string, number: number, exceptId?: string): Promise<void> {
  const existing = await RestaurantTable.findOne({ where: { restaurantId, number }, attributes: ['id'] });
  if (existing && existing.id !== exceptId) {
    throw conflict('TABLE_NUMBER_TAKEN', `Table number ${number} already exists`);
  }
}

export async function createTable(restaurantId: string, input: CreateTableInput): Promise<TableDto> {
  await assertNumberFree(restaurantId, input.number);
  const id = await sequelize.transaction(async (transaction) => {
    const table = await RestaurantTable.create(
      {
        restaurantId,
        number: input.number,
        label: input.label ?? `Table ${input.number}`,
        sortOrder: input.sortOrder ?? input.number,
      },
      { transaction },
    );
    await touchRestaurant(restaurantId, transaction);
    return table.id;
  });
  return getTable(restaurantId, id);
}

export async function updateTable(restaurantId: string, tableId: string, input: UpdateTableInput): Promise<TableDto> {
  const table = await loadTable(restaurantId, tableId);
  if (input.number !== undefined && input.number !== table.number) {
    await assertNumberFree(restaurantId, input.number, table.id);
  }
  await sequelize.transaction(async (transaction) => {
    await table.update(definedOnly(input), { transaction });
    await touchRestaurant(restaurantId, transaction);
  });
  return getTable(restaurantId, tableId);
}

export async function deleteTable(restaurantId: string, tableId: string): Promise<void> {
  const table = await loadTable(restaurantId, tableId);
  await sequelize.transaction(async (transaction) => {
    await table.destroy({ transaction }); // scan_events.table_id is set to NULL by the FK
    await touchRestaurant(restaurantId, transaction);
  });
}

export async function reorderTables(restaurantId: string, ids: string[]): Promise<TableDto[]> {
  await sequelize.transaction(async (transaction) => {
    await applySortOrder('tables', restaurantId, ids, transaction);
    await touchRestaurant(restaurantId, transaction);
  });
  return listTables(restaurantId);
}

export async function tableQrPng(restaurantId: string, tableId: string): Promise<Buffer> {
  const table = await getTable(restaurantId, tableId);
  return qrPng(table.menuUrl);
}

export async function tableQrSvg(restaurantId: string, tableId: string): Promise<string> {
  const table = await getTable(restaurantId, tableId);
  return qrSvg(table.menuUrl);
}

async function loadLogo(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  const key = storage.keyFromUrl(logoUrl);
  if (!key) return null;
  return storage.get(key);
}

export async function qrSheetPdf(restaurantId: string): Promise<{ pdf: Buffer; filename: string }> {
  const restaurant = await loadRestaurant(restaurantId);
  const tables = await listTables(restaurantId);
  const footer = buildMenuUrl(restaurant.slug).replace(/^https?:\/\//, '');
  const pdf = await renderQrSheet({
    restaurantName: restaurant.name,
    primaryColor: restaurant.primaryColor,
    logo: await loadLogo(restaurant.logoUrl),
    footer,
    cards: tables.map((table) => ({ label: table.label, url: table.menuUrl })),
  });
  return { pdf, filename: `qr-${restaurant.slug}.pdf` };
}
