import { useState } from 'react';
import type { TableDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { MobileHeader, PageHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { PrintAllModal } from '../components/tables/PrintAllModal';
import { QrImage } from '../components/tables/QrImage';
import { TableFormModal } from '../components/tables/TableFormModal';
import { Button, IconButton } from '../components/ui/Button';
import { Badge } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Menu } from '../components/ui/Menu';
import { ConfirmModal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { downloadBlob } from '../lib/download';
import { displayUrl, relativeTime } from '../lib/format';
import { downloads, useDeleteTable, useTables } from '../lib/queries';

const GRID = 'grid grid-cols-[56px_1fr_140px_120px_220px] items-center gap-3';

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

export function TablesPage() {
  const { restaurant, isOwner, isMobile } = useRestaurantContext();
  const toast = useToast();
  const query = useTables(restaurant.id);
  const remove = useDeleteTable(restaurant.id);
  const [editing, setEditing] = useState<TableDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<TableDto | null>(null);
  const [printing, setPrinting] = useState(false);
  const tables = query.data ?? [];

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
        <MobileTables tables={tables} loading={query.isPending} onAdd={() => setEditing('new')} onEdit={setEditing} onDelete={isOwner ? setDeleting : undefined} onPrint={() => setPrinting(true)} />
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
          <>
            <Button onClick={() => setEditing('new')}>Add table</Button>
            <Button variant="primary" icon={<Icon name="print" size={14} strokeWidth={1.8} />} onClick={() => setPrinting(true)} disabled={tables.length === 0}>
              Print all
            </Button>
          </>
        }
      />
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className={cn(GRID, 'h-9 border-b border-line-2 px-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted')}>
          <span />
          <span>Table</span>
          <span>Scans · 7d</span>
          <span>Last scan</span>
          <span>Download</span>
        </div>
        {query.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading tables">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(GRID, 'h-[60px] border-b border-line-2 px-4')}>
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
          <EmptyState variant="inline" title="No tables yet." description="Add your first table to get a QR code for it." actions={<Button size="sm" onClick={() => setEditing('new')}>Add table</Button>} />
        ) : (
          <ul aria-label="Tables">
            {tables.map((table) => (
              <DesktopTableRow key={table.id} table={table} onEdit={() => setEditing(table)} onDelete={isOwner ? () => setDeleting(table) : undefined} />
            ))}
          </ul>
        )}
      </div>
      {modals}
    </div>
  );
}

function DesktopTableRow({ table, onEdit, onDelete }: { table: TableDto; onEdit: () => void; onDelete?: () => void }) {
  const { restaurant } = useRestaurantContext();
  const { download, busy } = useTableActions();
  return (
    <li className={cn(GRID, 'h-[60px] border-b border-line-2 px-4 last:border-b-0')}>
      <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={40} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{table.label}</span>
        <span className="truncate text-xs text-muted">{displayUrl(table.menuUrl)}</span>
      </div>
      <div className="tabular-nums">{table.scansLast7Days}</div>
      <div className="text-[13px] text-muted">{relativeTime(table.lastScanAt)}</div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" loading={busy === `${table.id}-png`} onClick={() => void download(table, 'png')}>
          PNG
        </Button>
        <Button size="sm" className="h-8 rounded-md px-2.5 text-xs" loading={busy === `${table.id}-svg`} onClick={() => void download(table, 'svg')}>
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
    </li>
  );
}

interface MobileTablesProps {
  tables: TableDto[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (table: TableDto) => void;
  onDelete?: (table: TableDto) => void;
  onPrint: () => void;
}

/** Design M9: expandable rows with the QR, Share (Web Share API) and Download. */
function MobileTables({ tables, loading, onAdd, onEdit, onDelete, onPrint }: MobileTablesProps) {
  const { restaurant } = useRestaurantContext();
  const { download, share, busy } = useTableActions();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col">
      <MobileHeader
        large
        title="Tables & QR"
        action={
          <Button variant="accent-text" className="h-11 px-2" onClick={onAdd}>
            Add table
          </Button>
        }
      />
      <div className="px-4 pb-3 pt-1">
        <Button size="xl" block className="h-12 rounded-xl text-[15px]" icon={<Icon name="print" size={16} strokeWidth={1.8} />} onClick={onPrint} disabled={tables.length === 0}>
          Print all <Badge>OPENS PDF</Badge>
        </Button>
      </div>
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
          <EmptyState variant="inline" title="No tables yet." actions={<Button size="sm" onClick={onAdd}>Add table</Button>} />
        ) : (
          tables.map((table) => {
            const open = expanded === table.id;
            return (
              <div key={table.id} className="border-b border-line-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : table.id)}
                  className="flex h-[60px] w-full cursor-pointer items-center gap-3 px-4 text-left text-ink"
                >
                  <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={36} />
                  <span className="flex flex-1 flex-col gap-px">
                    <span className="text-base font-medium">{table.label}</span>
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
                      <Button size="xl" className="flex-1" icon={<Icon name="download" size={16} strokeWidth={1.8} />} loading={busy === `${table.id}-png`} onClick={() => void download(table, 'png')}>
                        Download
                      </Button>
                    </div>
                    <div className="flex gap-4 text-[13px]">
                      <button type="button" className="cursor-pointer font-medium text-accent" onClick={() => onEdit(table)}>
                        Edit
                      </button>
                      {onDelete ? (
                        <button type="button" className="cursor-pointer font-medium text-danger-text" onClick={() => onDelete(table)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
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
