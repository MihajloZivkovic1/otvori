import { useState } from 'react';
import type { OrderDto, ServiceRequestDto, TableDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { useOrdering } from '../components/orders/OrderingProvider';
import { useGuard } from '../components/security/ElevationProvider';
import { LockGlyph } from '../components/security/LockStatus';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { PrintAllModal } from '../components/tables/PrintAllModal';
import { QrImage } from '../components/tables/QrImage';
import { TableFormModal } from '../components/tables/TableFormModal';
import { Button, IconButton } from '../components/ui/Button';
import { Badge, MiniTag } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Menu } from '../components/ui/Menu';
import { ConfirmModal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { downloadBlob } from '../lib/download';
import { clock, displayUrl, relativeTime } from '../lib/format';
import { downloads, useBlockTable, useDeleteTable, useTables } from '../lib/queries';

const GRID = 'grid grid-cols-[56px_1fr_140px_120px_220px] items-center gap-3';
/** With ordering on: scans + last scan share a column to make room for "Ordering" (block / blocked chip). */
const GRID_ORDERING = 'grid grid-cols-[56px_1fr_120px_170px_210px] items-center gap-3';

function useTableActions() {
  const { restaurant } = useRestaurantContext();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (table: TableDto, format: 'png' | 'svg') => {
    setBusy(`${table.id}-${format}`);
    try {
      const blob = await downloads.qr(restaurant.id, table.id, format);
      downloadBlob(blob, `qr-${restaurant.slug}-table-${table.number}.${format}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the QR code'));
    } finally {
      setBusy(null);
    }
  };

  const share = async (table: TableDto) => {
    const data = { title: `${restaurant.name} · ${table.label}`, text: `Menu for ${table.label}`, url: table.menuUrl };
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(table.menuUrl);
      toast.success('Link copied');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('Could not share this link');
    }
  };

  return { download, share, busy };
}

/** "#142 NEW", "#141 IN PROGRESS", "1 CALL" for a table (design B6 "Open" column). */
function openTags(table: TableDto, orders: OrderDto[], requests: ServiceRequestDto[]): string[] {
  const tags = orders
    .filter((order) => order.tableId === table.id && (order.status === 'new' || order.status === 'accepted'))
    .map((order) => `#${order.number} ${order.status === 'new' ? 'new' : 'in progress'}`);
  const calls = requests.filter((request) => request.tableId === table.id && request.status === 'open').length;
  if (calls > 0) tags.push(`${calls} ${calls === 1 ? 'call' : 'calls'}`);
  return tags;
}

function isBlocked(table: TableDto, now = new Date()): boolean {
  return Boolean(table.blockedUntil && new Date(table.blockedUntil).getTime() > now.getTime());
}

/** "Block 30 min" ↔ "Blocked until 14:32 · Unblock" (both roles). */
function BlockControls({ table }: { table: TableDto }) {
  const { restaurant } = useRestaurantContext();
  const toast = useToast();
  const block = useBlockTable(restaurant.id);
  const blocked = isBlocked(table);
  const toggle = () => block.mutate({ id: table.id, block: !blocked }, { onError: (error) => toast.error(errorMessage(error)) });

  if (blocked) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#FEE2E2] px-2.5 text-xs font-semibold tabular-nums text-[#991B1B]">
          <Icon name="lock" size={12} strokeWidth={2.2} />
          Blocked until {clock(table.blockedUntil!)}
        </span>
        <Button variant="accent-text" size="sm" className="px-2 text-[13px]" onClick={toggle} loading={block.isPending}>
          Unblock
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" className="h-8 rounded-md px-3 text-[13px]" icon={<Icon name="lock" size={13} strokeWidth={2} />} onClick={toggle} loading={block.isPending}>
      Block 30 min
    </Button>
  );
}

const BLOCKED_NOTE = (
  <div className="flex flex-wrap items-baseline gap-2 px-4 py-3 text-xs text-muted">
    <span className="font-semibold text-ink-2">A guest at a blocked table sees:</span>
    <span className="italic">“Ordering from this table is temporarily disabled. Please call the waiter.”</span>
    <span className="ml-auto font-mono text-[11px] text-faint">423</span>
  </div>
);

export function TablesPage() {
  const { restaurant, isOwner, isMobile } = useRestaurantContext();
  const { guard } = useGuard();
  const toast = useToast();
  const query = useTables(restaurant.id);
  const remove = useDeleteTable(restaurant.id);
  const ordering = useOrdering();
  const [editing, setEditing] = useState<TableDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<TableDto | null>(null);
  const [printing, setPrinting] = useState(false);
  const tables = query.data ?? [];
  const grid = ordering.enabled ? GRID_ORDERING : GRID;

  const modals = (
    <>
      {editing !== null ? <TableFormModal table={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      {printing ? <PrintAllModal tables={tables} onClose={() => setPrinting(false)} /> : null}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.label} deleted`);
              setDeleting(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
        title={`Delete ${deleting?.label ?? 'table'}?`}
        description="Its QR code stops working. Past scans stay in analytics without a table."
        confirmLabel="Delete table"
        danger
        loading={remove.isPending}
      />
    </>
  );

  if (isMobile) {
    return (
      <>
        <MobileTables
          tables={tables}
          loading={query.isPending}
          canEdit={isOwner}
          onAdd={guard(() => setEditing('new'))}
          onEdit={guard((table: TableDto) => setEditing(table))}
          onDelete={isOwner ? guard((table: TableDto) => setDeleting(table)) : undefined}
          onPrint={guard(() => setPrinting(true))}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Tables & QR codes"
        subtitle="Each code opens the menu with the table pre-selected."
        actions={
          isOwner ? (
            <>
              <Button icon={<LockGlyph />} onClick={guard(() => setEditing('new'))}>
                Add table
              </Button>
              <Button variant="primary" icon={<Icon name="print" size={14} strokeWidth={1.8} />} onClick={guard(() => setPrinting(true))} disabled={tables.length === 0}>
                Print all
              </Button>
            </>
          ) : (
            <span className="text-[13px] text-muted">The owner manages tables and prints QR codes.</span>
          )
        }
      />
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className={cn(grid, 'h-9 border-b border-line-2 px-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted')}>
          <span />
          <span>Table</span>
          <span>{ordering.enabled ? 'Scans · 7d' : 'Scans · 7d'}</span>
          <span>{ordering.enabled ? 'Download' : 'Last scan'}</span>
          <span>{ordering.enabled ? 'Ordering' : 'Download'}</span>
        </div>
        {query.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading tables">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(grid, 'h-[60px] border-b border-line-2 px-4')}>
                <Skeleton className="size-10 rounded-md" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-3.5 w-8" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState variant="inline" title="Could not load tables" description={errorMessage(query.error)} actions={<Button size="sm" onClick={() => void query.refetch()}>Try again</Button>} />
        ) : tables.length === 0 ? (
          <EmptyState variant="inline" title="No tables yet." description="Add your first table to get a QR code for it." actions={isOwner ? <Button size="sm" onClick={guard(() => setEditing('new'))}>Add table</Button> : undefined} />
        ) : (
          <ul aria-label="Tables">
            {tables.map((table) => (
              <DesktopTableRow key={table.id} table={table} grid={grid} canEdit={isOwner} onEdit={guard(() => setEditing(table))} onDelete={isOwner ? guard(() => setDeleting(table)) : undefined} />
            ))}
          </ul>
        )}
        {ordering.enabled && tables.length > 0 ? BLOCKED_NOTE : null}
      </div>
      {modals}
    </div>
  );
}

function DesktopTableRow({ table, grid, canEdit, onEdit, onDelete }: { table: TableDto; grid: string; canEdit: boolean; onEdit: () => void; onDelete?: () => void }) {
  const { restaurant } = useRestaurantContext();
  const ordering = useOrdering();
  const { guard } = useGuard();
  const { download, busy } = useTableActions();
  const tags = ordering.enabled ? openTags(table, ordering.orders, ordering.requests) : [];
  const downloadsCell = canEdit ? (
    <div className="flex items-center gap-1.5">
      <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" icon={<LockGlyph />} loading={busy === `${table.id}-png`} onClick={guard(() => void download(table, 'png'))}>
        PNG
      </Button>
      <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" loading={busy === `${table.id}-svg`} onClick={guard(() => void download(table, 'svg'))}>
        SVG
      </Button>
      <Menu
        items={[
          { label: 'Edit table', onSelect: onEdit },
          { label: 'Copy link', onSelect: () => void navigator.clipboard?.writeText(table.menuUrl) },
          ...(onDelete ? [{ label: 'Delete table', onSelect: onDelete, danger: true }] : []),
        ]}
        trigger={(props) => (
          <IconButton label={`More actions for ${table.label}`} className="ml-auto" {...props}>
            <Icon name="more" size={16} />
          </IconButton>
        )}
      />
    </div>
  ) : (
    <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" onClick={() => void navigator.clipboard?.writeText(table.menuUrl)}>
      Copy link
    </Button>
  );

  return (
    <li className={cn(grid, 'min-h-[60px] border-b border-line-2 px-4 py-2 last:border-b-0')}>
      <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={40} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{table.label}</span>
          {tags.map((tag) => (
            <MiniTag key={tag} className="shrink-0 bg-accent-soft text-accent">
              {tag}
            </MiniTag>
          ))}
        </span>
        <span className="truncate text-xs text-muted">{displayUrl(table.menuUrl)}</span>
      </div>
      {ordering.enabled ? (
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums">{table.scansLast7Days}</span>
          <span className="text-xs text-muted">{relativeTime(table.lastScanAt)}</span>
        </div>
      ) : (
        <div className="tabular-nums">{table.scansLast7Days}</div>
      )}
      {ordering.enabled ? downloadsCell : <div className="text-[13px] text-muted">{relativeTime(table.lastScanAt)}</div>}
      {ordering.enabled ? <BlockControls table={table} /> : downloadsCell}
    </li>
  );
}

interface MobileTablesProps {
  tables: TableDto[];
  loading: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (table: TableDto) => void;
  onDelete?: (table: TableDto) => void;
  onPrint: () => void;
}

/** Design M9: expandable rows with the QR, Share (Web Share API), Download and, with ordering on, the 30-minute block. */
function MobileTables({ tables, loading, canEdit, onAdd, onEdit, onDelete, onPrint }: MobileTablesProps) {
  const { restaurant } = useRestaurantContext();
  const ordering = useOrdering();
  const { guard } = useGuard();
  const { download, share, busy } = useTableActions();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader
        large
        title="Tables & QR"
        action={
          canEdit ? (
            <Button variant="accent-text" className="h-11 px-2" icon={<LockGlyph />} onClick={onAdd}>
              Add table
            </Button>
          ) : null
        }
      />
      {canEdit ? (
        <div className="px-4 pb-3 pt-1">
          <Button size="xl" block className="h-12 rounded-xl text-[15px]" icon={<Icon name="print" size={16} strokeWidth={1.8} />} onClick={onPrint} disabled={tables.length === 0}>
            Print all <Badge>OPENS PDF</Badge>
          </Button>
        </div>
      ) : null}
      <div className="flex-1 border-t border-line-2 bg-surface">
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading tables">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-[60px] items-center gap-3 border-b border-line-2 px-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : tables.length === 0 ? (
          <EmptyState variant="inline" title="No tables yet." actions={canEdit ? <Button size="sm" onClick={onAdd}>Add table</Button> : undefined} />
        ) : (
          tables.map((table) => {
            const open = expanded === table.id;
            const tags = ordering.enabled ? openTags(table, ordering.orders, ordering.requests) : [];
            const blocked = ordering.enabled && isBlocked(table);
            return (
              <div key={table.id} className="border-b border-line-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : table.id)}
                  className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-ink"
                >
                  <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-base font-medium">{table.label}</span>
                      {blocked ? <MiniTag className="bg-[#FEE2E2] text-[#991B1B]">Blocked</MiniTag> : null}
                      {tags.map((tag) => (
                        <MiniTag key={tag} className="bg-accent-soft text-accent">
                          {tag}
                        </MiniTag>
                      ))}
                    </span>
                    <span className="text-xs text-muted">{table.scansLast7Days} scans · 7d</span>
                  </span>
                  <Icon name="chevronRight" size={16} strokeWidth={1.8} className={cn('text-muted transition-transform', open && 'rotate-90')} />
                </button>
                {open ? (
                  <div className="flex flex-col items-center gap-3.5 bg-canvas px-4 pb-5 pt-1">
                    <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={180} className="rounded-[10px]" />
                    <span className="text-xs text-muted">{displayUrl(table.menuUrl)}</span>
                    <div className="flex w-full gap-2">
                      <Button variant="primary" size="xl" className="flex-1" icon={<Icon name="share" size={16} strokeWidth={1.8} />} onClick={() => void share(table)}>
                        Share
                      </Button>
                      {canEdit ? (
                        <Button size="xl" className="flex-1" icon={<Icon name="download" size={16} strokeWidth={1.8} />} loading={busy === `${table.id}-png`} onClick={guard(() => void download(table, 'png'))}>
                          Download
                        </Button>
                      ) : null}
                    </div>
                    {ordering.enabled ? <BlockControls table={table} /> : null}
                    {canEdit ? (
                      <div className="flex gap-4 text-[13px]">
                        <button type="button" className="inline-flex cursor-pointer items-center gap-1 font-medium text-accent" onClick={() => onEdit(table)}>
                          <LockGlyph />
                          Edit
                        </button>
                        {onDelete ? (
                          <button type="button" className="cursor-pointer font-medium text-danger-text" onClick={() => onDelete(table)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
