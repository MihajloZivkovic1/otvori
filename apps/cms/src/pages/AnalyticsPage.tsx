import { useSearchParams } from 'react-router';
import { ANALYTICS_RANGE_DAYS, ANALYTICS_RANGES, type AnalyticsDto, type AnalyticsRange } from '@qr-menu/shared';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Segmented } from '../components/ui/Segmented';
import { Skeleton } from '../components/ui/Skeleton';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { formatPrice, minutesSeconds, percent, shortDate, text } from '../lib/format';
import { useAnalytics } from '../lib/queries';

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
] as const;

const count = new Intl.NumberFormat('en');

function isRange(value: string | null): value is AnalyticsRange {
  return (ANALYTICS_RANGES as readonly string[]).includes(value ?? '');
}

export function AnalyticsPage() {
  const { restaurant, isMobile } = useRestaurantContext();
  const [params, setParams] = useSearchParams();
  const range: AnalyticsRange = isRange(params.get('range')) ? (params.get('range') as AnalyticsRange) : '7d';
  const query = useAnalytics(restaurant.id, range);

  const picker = (
    <Segmented
      label="Date range"
      options={RANGE_OPTIONS}
      value={range}
      onChange={(next) => setParams({ range: next }, { replace: true })}
    />
  );

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-6' : 'gap-4 p-6')}>
      {isMobile ? (
        <>
          <MobileHeader large title="Analytics" />
          <div className="px-4">{picker}</div>
        </>
      ) : (
        <PageHeader title="Analytics" subtitle="Scans are counted when a guest opens the menu from a QR code." actions={picker} />
      )}
      <div className={cn('flex flex-col gap-4', isMobile && 'px-4')}>
        {query.isPending ? (
          <AnalyticsSkeleton />
        ) : query.isError ? (
          <EmptyState variant="inline" icon="warning" title="Could not load analytics" description={errorMessage(query.error)} actions={<Button size="sm" onClick={() => void query.refetch()}>Try again</Button>} />
        ) : (
          <Report
            data={query.data}
            defaultLocale={restaurant.defaultLocale}
            currency={restaurant.currency}
            rangeDays={ANALYTICS_RANGE_DAYS[range]}
            showOrdering={restaurant.orderingMode !== 'off' || query.data.ordering.orders.value > 0}
          />
        )}
      </div>
    </div>
  );
}

interface ReportProps {
  data: AnalyticsDto;
  defaultLocale: string;
  currency: string;
  rangeDays: number;
  /** Ordering card (design B8): shown while ordering is on, or when the period has orders anyway. */
  showOrdering: boolean;
}

function Report({ data, defaultLocale, currency, rangeDays, showOrdering }: ReportProps) {
  const days = data.scansPerDay;
  const max = Math.max(0, ...days.map((d) => d.scans));
  const peak = days.reduce<{ date: string; scans: number } | null>((best, day) => (!best || day.scans > best.scans ? day : best), null);
  const viewsDelta = data.itemsViewedPerScan.value - data.itemsViewedPerScan.previous;
  const topMax = data.topItems[0]?.views ?? 0;
  const tables = [...data.scansByTable].sort((a, b) => b.scans - a.scans).slice(0, 5);
  const tableMax = tables[0]?.scans ?? 0;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 max-tab:grid-cols-1 max-tab:gap-3">
        <StatCard label="Total scans" value={count.format(data.totalScans.value)} delta={percent(data.totalScans.deltaPct)} tone={data.totalScans.deltaPct !== null && data.totalScans.deltaPct >= 0 ? 'good' : 'neutral'} />
        <StatCard
          label="Avg per day"
          value={count.format(Math.round(data.avgPerDay.value))}
          delta={peak && peak.scans > 0 ? `Peak ${peak.scans} on ${shortDate(peak.date)}` : 'No scans in this period'}
          tone="neutral"
        />
        <StatCard
          label="Items viewed per scan"
          value={data.itemsViewedPerScan.value.toFixed(1)}
          delta={data.totalScans.previous === 0 ? 'No previous data' : `${viewsDelta > 0 ? '+' : viewsDelta < 0 ? '−' : ''}${Math.abs(viewsDelta).toFixed(1)} vs previous period`}
          tone={viewsDelta > 0 ? 'good' : 'neutral'}
        />
      </div>

      <section className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-5" aria-labelledby="scans-per-day">
        <div className="flex items-baseline justify-between">
          <h2 id="scans-per-day" className="text-sm font-semibold">
            Scans per day
          </h2>
          <span className="text-xs text-muted">{days.length} days</span>
        </div>
        <div className="flex h-40 items-end gap-1.5 border-b border-line" role="img" aria-label={`Scans per day, ${days.length} days, ${count.format(data.totalScans.value)} scans in total`}>
          {days.map((day, index) => (
            <div key={day.date} title={`${shortDate(day.date)}: ${day.scans} scans`} className="flex h-full flex-1 flex-col justify-end">
              <div
                className={cn('rounded-t-[3px]', index === days.length - 1 ? 'bg-accent' : 'bg-bar-muted')}
                style={{ height: max > 0 ? `${Math.max(day.scans > 0 ? 2 : 0, Math.round((day.scans / max) * 100))}%` : '0%' }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-faint">
          <span>{days[0] ? shortDate(days[0].date) : ''}</span>
          <span>{days[days.length - 1] ? shortDate(days[days.length - 1]!.date) : ''}</span>
        </div>
      </section>

      {showOrdering ? <OrderingStats data={data} currency={currency} days={rangeDays} /> : null}

      <div className="grid grid-cols-2 gap-4 max-tab:grid-cols-1 max-tab:gap-3">
        <RankedList
          title="Most viewed items"
          empty="No item views yet."
          rows={data.topItems.slice(0, 5).map((item) => ({
            key: item.itemId,
            label: text(item.name, defaultLocale) || 'Untitled item',
            value: item.views,
            width: topMax ? (item.views / topMax) * 100 : 0,
          }))}
          barClass="bg-accent"
        />
        <RankedList
          title="Scans by table"
          empty="No scans yet."
          rows={tables.map((table) => ({
            key: table.tableId ?? 'none',
            label: table.label,
            value: table.scans,
            width: tableMax ? (table.scans / tableMax) * 100 : 0,
          }))}
          barClass="bg-faint"
        />
      </div>
    </>
  );
}

/** Orders, accepted rate, median time to accept, ordered revenue (design B8). */
function OrderingStats({ data, currency, days }: { data: AnalyticsDto; currency: string; days: number }) {
  const { ordering } = data;
  const stats = [
    { value: count.format(ordering.orders.value), label: ordering.orders.value === 1 ? 'order' : 'orders', delta: percent(ordering.orders.deltaPct) },
    { value: `${Math.round(ordering.acceptedRate.value)}%`, label: 'accepted', delta: percent(ordering.acceptedRate.deltaPct) },
    { value: minutesSeconds(ordering.medianAcceptSeconds), label: 'median time to accept', delta: ordering.previousMedianAcceptSeconds === null ? 'No previous data' : `${minutesSeconds(ordering.previousMedianAcceptSeconds)} previous period` },
    { value: formatPrice(ordering.orderedRevenueCents.value, currency), label: 'ordered', delta: percent(ordering.orderedRevenueCents.deltaPct) },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-5" aria-labelledby="ordering-stats">
      <div className="flex items-center justify-between">
        <h2 id="ordering-stats" className="text-[15px] font-semibold">
          Ordering
        </h2>
        <span className="text-xs text-muted">Last {days} days</span>
      </div>
      <dl className="grid grid-cols-4 gap-x-5 gap-y-3.5 max-tab:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <dd className="text-2xl font-semibold leading-[1.1] tracking-[-.01em] tabular-nums">{stat.value}</dd>
            <dt className="text-xs text-muted">{stat.label}</dt>
            <span className="text-[11px] text-faint">{stat.delta}</span>
          </div>
        ))}
      </dl>
      <p className="border-t border-line-2 pt-2.5 text-xs text-faint">Ordered ≠ paid: guests pay the waiter, so this is the sum of accepted and delivered orders.</p>
    </section>
  );
}

function StatCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: 'good' | 'neutral' }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-surface px-5 py-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[26px] font-semibold leading-[1.1] tracking-[-.02em] tabular-nums">{value}</span>
      <span className={cn('text-xs', tone === 'good' ? 'text-success' : 'text-muted')}>{delta}</span>
    </div>
  );
}

interface RankedRow {
  key: string;
  label: string;
  value: number;
  width: number;
}

function RankedList({ title, rows, empty, barClass }: { title: string; rows: RankedRow[]; empty: string; barClass: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-[13px] text-muted">{empty}</p> : null}
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-[5px]">
          <div className="flex justify-between text-[13px]">
            <span className="truncate">{row.label}</span>
            <span className="tabular-nums text-muted">{count.format(row.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-line-2">
            <div className={cn('h-full rounded-[3px]', barClass)} style={{ width: `${Math.max(row.value > 0 ? 2 : 0, row.width)}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading analytics" className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4 max-tab:grid-cols-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface px-5 py-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5">
        <Skeleton className="mb-4 h-3.5 w-28" />
        <div className="flex h-40 items-end gap-1.5">
          {[40, 60, 35, 80, 55, 70, 90].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-[3px] rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
