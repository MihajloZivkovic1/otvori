import { QueryTypes } from 'sequelize';
import { ANALYTICS_RANGE_DAYS, type AnalyticsDto, type AnalyticsRange, type TranslatedText } from '@qr-menu/shared';
import { Restaurant } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { notFound } from '../../utils/errors.js';
import { formatZonedDate, startOfDayInZone } from '../../utils/time.js';

interface Period {
  from: Date;
  to: Date;
}

interface DayRow {
  day: string;
  scans: number;
}
interface ItemRow {
  item_id: string;
  name: TranslatedText;
  views: number;
}
interface TableRow {
  table_id: string | null;
  number: number | null;
  label: string;
  scans: number;
}

function select<T>(sql: string, replacements: Record<string, unknown>): Promise<T[]> {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements }) as Promise<T[]>;
}

async function countScans(restaurantId: string, period: Period): Promise<number> {
  const rows = await select<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM scan_events
     WHERE restaurant_id = :restaurantId AND scanned_at >= :from AND scanned_at < :to`,
    { restaurantId, from: period.from, to: period.to },
  );
  return rows[0]?.count ?? 0;
}

async function countItemViews(restaurantId: string, period: Period): Promise<number> {
  const rows = await select<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM item_views iv
     JOIN scan_events se ON se.id = iv.scan_event_id
     WHERE se.restaurant_id = :restaurantId AND iv.viewed_at >= :from AND iv.viewed_at < :to`,
    { restaurantId, from: period.from, to: period.to },
  );
  return rows[0]?.count ?? 0;
}

function scansPerDay(restaurantId: string, period: Period, timezone: string): Promise<DayRow[]> {
  return select<DayRow>(
    `SELECT to_char((scanned_at AT TIME ZONE :timezone)::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS scans
     FROM scan_events
     WHERE restaurant_id = :restaurantId AND scanned_at >= :from AND scanned_at < :to
     GROUP BY 1 ORDER BY 1`,
    { restaurantId, from: period.from, to: period.to, timezone },
  );
}

function topItems(restaurantId: string, period: Period, limit: number): Promise<ItemRow[]> {
  return select<ItemRow>(
    `SELECT mi.id AS item_id, mi.name, COUNT(*)::int AS views
     FROM item_views iv
     JOIN scan_events se ON se.id = iv.scan_event_id
     JOIN menu_items mi ON mi.id = iv.menu_item_id
     WHERE se.restaurant_id = :restaurantId AND iv.viewed_at >= :from AND iv.viewed_at < :to
     GROUP BY mi.id ORDER BY views DESC, mi.id LIMIT :limit`,
    { restaurantId, from: period.from, to: period.to, limit },
  );
}

async function viewsForItems(restaurantId: string, period: Period, itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await select<{ item_id: string; views: number }>(
    `SELECT iv.menu_item_id AS item_id, COUNT(*)::int AS views
     FROM item_views iv
     JOIN scan_events se ON se.id = iv.scan_event_id
     WHERE se.restaurant_id = :restaurantId AND iv.viewed_at >= :from AND iv.viewed_at < :to
       AND iv.menu_item_id IN (:itemIds)
     GROUP BY iv.menu_item_id`,
    { restaurantId, from: period.from, to: period.to, itemIds },
  );
  return new Map(rows.map((row) => [row.item_id, row.views]));
}

async function scansByTable(restaurantId: string, period: Period): Promise<TableRow[]> {
  const tables = await select<TableRow>(
    `SELECT t.id AS table_id, t.number, t.label, COUNT(se.id)::int AS scans
     FROM tables t
     LEFT JOIN scan_events se
       ON se.table_id = t.id AND se.scanned_at >= :from AND se.scanned_at < :to
     WHERE t.restaurant_id = :restaurantId
     GROUP BY t.id ORDER BY t.sort_order, t.number`,
    { restaurantId, from: period.from, to: period.to },
  );
  const noTable = await select<{ scans: number }>(
    `SELECT COUNT(*)::int AS scans FROM scan_events
     WHERE restaurant_id = :restaurantId AND table_id IS NULL AND scanned_at >= :from AND scanned_at < :to`,
    { restaurantId, from: period.from, to: period.to },
  );
  const orphan = noTable[0]?.scans ?? 0;
  return orphan > 0 ? [...tables, { table_id: null, number: null, label: 'No table', scans: orphan }] : tables;
}

export function deltaPct(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null;
  return Math.round(((value - previous) / previous) * 1000) / 10;
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export async function getAnalytics(restaurantId: string, range: AnalyticsRange, now = new Date()): Promise<AnalyticsDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'timezone'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  const timezone = restaurant.timezone;
  const days = ANALYTICS_RANGE_DAYS[range];

  // Current period: the last `days` calendar days (restaurant time zone) up to now.
  const current: Period = { from: startOfDayInZone(now, timezone, -(days - 1)), to: now };
  const previous: Period = { from: startOfDayInZone(now, timezone, -(2 * days - 1)), to: current.from };

  const [scans, prevScans, views, prevViews, perDay, top, byTable, prevByTable] = await Promise.all([
    countScans(restaurantId, current),
    countScans(restaurantId, previous),
    countItemViews(restaurantId, current),
    countItemViews(restaurantId, previous),
    scansPerDay(restaurantId, current, timezone),
    topItems(restaurantId, current, 10),
    scansByTable(restaurantId, current),
    scansByTable(restaurantId, previous),
  ]);
  const prevTopViews = await viewsForItems(
    restaurantId,
    previous,
    top.map((row) => row.item_id),
  );

  const perDayMap = new Map(perDay.map((row) => [row.day, row.scans]));
  const scansPerDayFilled = Array.from({ length: days }, (_, index) => {
    const date = formatZonedDate(startOfDayInZone(now, timezone, -(days - 1) + index), timezone);
    return { date, scans: perDayMap.get(date) ?? 0 };
  });

  const prevTableMap = new Map(prevByTable.map((row) => [row.table_id ?? 'none', row.scans]));
  const avg = round(scans / days, 1);
  const prevAvg = round(prevScans / days, 1);
  const perScan = scans ? round(views / scans, 2) : 0;
  const prevPerScan = prevScans ? round(prevViews / prevScans, 2) : 0;

  return {
    range,
    timezone,
    period: { from: current.from.toISOString(), to: current.to.toISOString() },
    previousPeriod: { from: previous.from.toISOString(), to: previous.to.toISOString() },
    totalScans: { value: scans, previous: prevScans, deltaPct: deltaPct(scans, prevScans) },
    avgPerDay: { value: avg, previous: prevAvg, deltaPct: deltaPct(avg, prevAvg) },
    itemsViewedPerScan: { value: perScan, previous: prevPerScan, deltaPct: deltaPct(perScan, prevPerScan) },
    scansPerDay: scansPerDayFilled,
    topItems: top.map((row) => {
      const previousViews = prevTopViews.get(row.item_id) ?? 0;
      return { itemId: row.item_id, name: row.name, views: row.views, previousViews, deltaPct: deltaPct(row.views, previousViews) };
    }),
    scansByTable: byTable.map((row) => {
      const previousScans = prevTableMap.get(row.table_id ?? 'none') ?? 0;
      return {
        tableId: row.table_id,
        number: row.number,
        label: row.label,
        scans: row.scans,
        previousScans,
        deltaPct: deltaPct(row.scans, previousScans),
      };
    }),
  };
}
