import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Sortable columns send their key to `onSort`. */
  sortable?: boolean;
  /** Numbers and dates sit right-aligned. */
  align?: 'left' | 'right';
  /** CSS width of the column (e.g. "140px"); the first column takes the rest. */
  width?: string;
  /** Extra classes on both the header and the cells (e.g. "max-wide:hidden"). */
  className?: string;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

interface DataTableProps<T> {
  ariaLabel: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState;
  onSort?: (key: string) => void;
  /** Rows become focusable links: click, Enter and Space open them; ↑/↓ move between rows. */
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  error?: unknown;
  onRetry?: () => void;
  errorMessage?: (error: unknown) => string;
  empty?: ReactNode;
  pagination?: PaginationState;
  /** Stale data while the next page loads. */
  dimmed?: boolean;
  /** Phone layout: one card per row instead of a table. */
  mobile?: boolean;
  mobileRow?: (row: T) => ReactNode;
  className?: string;
}

/** "Showing 1–50 of 212" */
export function rangeLabel({ page, pageSize, total }: Omit<PaginationState, 'onPage'>): string {
  if (total === 0) return 'No results';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return `Showing ${from}–${to} of ${total}`;
}

export function Pagination({ page, pageSize, total, onPage, className }: PaginationState & { className?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3 text-[13px] text-muted', className)}>
      <span aria-live="polite">{rangeLabel({ page, pageSize, total })}</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          Previous
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          Next
        </Button>
      </div>
    </nav>
  );
}

/**
 * The admin list table: sticky header, sort indicators, right-aligned numbers, hover rows, keyboard navigation,
 * skeleton / error / empty states and the "Showing 1–50 of 212" footer. Phones get a card list.
 */
export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  onRowClick,
  rowLabel,
  loading = false,
  skeletonRows = 6,
  error,
  onRetry,
  errorMessage = () => 'Could not load this list',
  empty,
  pagination,
  dimmed = false,
  mobile = false,
  mobileRow,
  className,
}: DataTableProps<T>) {
  const bodyRef = useRef<HTMLTableSectionElement | HTMLUListElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: T) => {
    const target = event.currentTarget;
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.target !== target) return;
      event.preventDefault();
      onRowClick?.(row);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    const focusable = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    const index = focusable.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : focusable.length - 1;
    focusable[Math.max(0, Math.min(focusable.length - 1, next))]?.focus();
  };

  const header = (column: Column<T>) => {
    const active = sort?.key === column.key;
    const dir = active ? sort!.dir : undefined;
    const content = (
      <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'flex-row-reverse')}>
        {column.header}
        {column.sortable ? (
          <Icon
            name={dir === 'asc' ? 'chevronDown' : 'chevronDown'}
            size={12}
            strokeWidth={2}
            className={cn('transition-transform', active ? 'text-ink' : 'text-faint opacity-0 group-hover:opacity-100', dir === 'asc' && 'rotate-180')}
          />
        ) : null}
      </span>
    );
    if (!column.sortable || !onSort) return content;
    return (
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn('group -mx-1 inline-flex h-7 cursor-pointer items-center rounded px-1 hover:text-ink', column.align === 'right' && 'justify-end')}
      >
        {content}
      </button>
    );
  };

  let body: ReactNode;
  if (loading) {
    body = mobile ? (
      <ul role="status" aria-busy="true" aria-label={`Loading ${ariaLabel.toLowerCase()}`} className="flex flex-col">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <li key={i} className="flex h-16 items-center gap-3 border-b border-line-2 px-4">
            <Skeleton className="size-9 rounded-[9px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <tbody role="status" aria-busy="true" aria-label={`Loading ${ariaLabel.toLowerCase()}`}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <tr key={i} className="h-14 border-b border-line-2">
            {columns.map((column, c) => (
              <td key={column.key} className={cn('px-3', column.className)}>
                <Skeleton className={cn('h-3.5', c === 0 ? 'w-44' : 'w-16', column.align === 'right' && 'ml-auto')} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  } else if (error) {
    const state = <EmptyState variant="inline" icon="warning" title={errorMessage(error)} actions={onRetry ? <Button size="sm" onClick={onRetry}>Try again</Button> : undefined} />;
    body = mobile ? state : <tbody><tr><td colSpan={columns.length}>{state}</td></tr></tbody>;
  } else if (rows.length === 0) {
    const state = empty ?? <EmptyState variant="inline" title="Nothing here yet." />;
    body = mobile ? <div>{state}</div> : <tbody><tr><td colSpan={columns.length}>{state}</td></tr></tbody>;
  } else if (mobile) {
    body = (
      <ul ref={bodyRef as React.RefObject<HTMLUListElement>} aria-label={ariaLabel} className={cn('flex flex-col', dimmed && 'opacity-60')}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="border-b border-line-2 last:border-b-0">
            {onRowClick ? (
              <button
                type="button"
                data-row
                aria-label={rowLabel?.(row)}
                onClick={() => onRowClick(row)}
                onKeyDown={(event) => onKeyDown(event, row)}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-ink active:bg-line-2"
              >
                {mobileRow ? mobileRow(row) : columns[0]!.cell(row)}
              </button>
            ) : (
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">{mobileRow ? mobileRow(row) : columns[0]!.cell(row)}</div>
            )}
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <tbody ref={bodyRef as React.RefObject<HTMLTableSectionElement>} className={cn(dimmed && 'opacity-60')}>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            data-row={onRowClick ? '' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'link' : undefined}
            aria-label={onRowClick ? rowLabel?.(row) : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (event) => onKeyDown(event, row) : undefined}
            className={cn('h-14 border-b border-line-2 last:border-b-0', onRowClick && 'cursor-pointer hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')}
          >
            {columns.map((column) => (
              <td key={column.key} className={cn('px-3 align-middle text-[13px]', column.align === 'right' && 'text-right tabular-nums', column.className)}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className={cn('bg-surface', mobile ? 'border-y border-line' : 'overflow-x-auto rounded-[10px] border border-line')}>
        {mobile ? (
          body
        ) : (
          <table aria-label={ariaLabel} className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-surface">
              <tr className="h-9 border-b border-line-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn('px-3 font-semibold', column.align === 'right' && 'text-right', column.className)}
                  >
                    {header(column)}
                  </th>
                ))}
              </tr>
            </thead>
            {body}
          </table>
        )}
      </div>
      {pagination && !loading && !error ? <Pagination {...pagination} className={mobile ? 'px-4' : ''} /> : null}
    </div>
  );
}
