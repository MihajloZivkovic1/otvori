import { useRef, useState, type DragEvent } from 'react';
import type { Allergen, MenuImportPreviewDto, MenuImportResultDto, Tag } from '@qr-menu/shared';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { MENU_TEMPLATE_PATH, useMenuImport, useMenuImportPreview } from '../../lib/admin';
import { apiBlob, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { downloadBlob } from '../../lib/download';
import { formatPrice } from '../../lib/format';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

interface ImportMenuModalProps {
  restaurantId: string;
  currency?: string;
  onClose: () => void;
  onImported?: (result: MenuImportResultDto) => void;
}

/**
 * "Import from spreadsheet": template download (CSV / XLSX), file pick or drop, server-side parse with a per-row
 * preview and errors, then import of the valid rows. Shared by the menu editor and the onboarding wizard.
 */
export function ImportMenuModal({ restaurantId, currency = 'RSD', onClose, onImported }: ImportMenuModalProps) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMenuImportPreview(restaurantId);
  const importMenu = useMenuImport(restaurantId);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<MenuImportPreviewDto | null>(null);
  const [existing, setExisting] = useState<'merge' | 'skip'>('merge');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<MenuImportResultDto | null>(null);

  const pick = (next: File | undefined) => {
    if (!next) return;
    setFile(next);
    setData(null);
    preview.mutate(next, { onSuccess: setData, onError: (error) => toast.error(errorMessage(error, 'Could not read the file')) });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    pick(event.dataTransfer.files[0]);
  };

  const template = async (format: 'csv' | 'xlsx') => {
    try {
      downloadBlob(await apiBlob(MENU_TEMPLATE_PATH(restaurantId, format)), `otvori-meni-sablon.${format}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the template'));
    }
  };

  const run = () => {
    if (!data) return;
    // The preview already validated the codes; the API re-validates with the same schema.
    const rows = data.rows
      .filter((r) => r.errors.length === 0)
      .map(({ category, name, description, priceCents, allergens, tags }) => ({ category, name, description, priceCents: priceCents ?? 0, allergens: allergens as Allergen[], tags: tags as Tag[] }));
    importMenu.mutate(
      { rows, existing },
      {
        onSuccess: (res) => {
          setResult(res);
          onImported?.(res);
        },
        onError: (error) => toast.error(errorMessage(error, 'Import failed')),
      },
    );
  };

  const body = result ? (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name="check" size={22} strokeWidth={2.4} />
      </span>
      <h3 className="text-base font-semibold">
        {result.itemsCreated} {result.itemsCreated === 1 ? 'item' : 'items'} imported
      </h3>
      <p className="text-[13px] text-muted">
        {result.categoriesCreated} new {result.categoriesCreated === 1 ? 'category' : 'categories'}
        {result.categoriesReused ? ` · ${result.categoriesReused} existing used` : ''}
        {result.rowsSkipped ? ` · ${result.rowsSkipped} rows skipped` : ''}. Every imported item is available; photos can be added one by one.
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>Start from the template:</span>
        <Button size="sm" icon={<Icon name="download" size={13} />} onClick={() => void template('xlsx')}>
          Excel (.xlsx)
        </Button>
        <Button size="sm" icon={<Icon name="download" size={13} />} onClick={() => void template('csv')}>
          CSV
        </Button>
      </div>
      <p className="text-xs text-muted">
        Columns: category, name_sr, name_en, description_sr, description_en, price (in RSD, e.g. 290 or 1.290,50), allergens (G, M, E, N, S, F, C, Se — comma-separated), tags (vegan, spicy, new). The first row holds the column names; Serbian headers (Kategorija, Naziv, Cena…) work too.
      </p>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a spreadsheet"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn('flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border border-dashed px-4 py-6 text-center transition-colors', dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong hover:bg-line-2')}
      >
        <Icon name="upload" size={20} className="text-muted" />
        <span className="text-sm font-medium">{file ? file.name : 'Drop the file here or click to choose'}</span>
        <span className="text-xs text-muted">CSV or XLSX, up to 2 MB, up to 1000 rows</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Spreadsheet file"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </div>
      {preview.isPending ? <p className="text-[13px] text-muted">Reading the file…</p> : null}
      {data ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Badge className="bg-accent-soft text-accent">{data.valid} OK</Badge>
            {data.invalid ? <Badge className="bg-[#FEF2F2] text-danger-text">{data.invalid} WITH ERRORS</Badge> : null}
            <span className="text-muted">
              {data.categories.length} {data.categories.length === 1 ? 'category' : 'categories'}
              {data.existingCategories.length ? ` · ${data.existingCategories.length} already exist` : ''}
              {data.unknownColumns.length ? ` · ignored columns: ${data.unknownColumns.join(', ')}` : ''}
            </span>
          </div>
          {data.existingCategories.length ? (
            <div role="radiogroup" aria-label="Existing categories" className="flex flex-wrap gap-2 text-[13px]">
              {(
                [
                  ['merge', `Add items to existing categories (${data.existingCategories.join(', ')})`],
                  ['skip', 'Skip rows whose category already exists'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex cursor-pointer items-center gap-1.5">
                  <input type="radio" name="existing" checked={existing === value} onChange={() => setExisting(value)} className="accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
          <div className="max-h-[40dvh] overflow-auto rounded-[10px] border border-line">
            <table className="w-full border-collapse text-left text-[13px]" aria-label="Preview">
              <thead className="sticky top-0 bg-surface">
                <tr className="h-8 border-b border-line-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">
                  <th className="px-2.5 font-semibold">#</th>
                  <th className="px-2.5 font-semibold">Category</th>
                  <th className="px-2.5 font-semibold">Name</th>
                  <th className="px-2.5 text-right font-semibold">Price</th>
                  {isMobile ? null : <th className="px-2.5 font-semibold">Tags</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.line} className={cn('border-b border-line-2 align-top last:border-b-0', row.errors.length > 0 && 'bg-[#FEF2F2]')} data-invalid={row.errors.length ? '' : undefined}>
                    <td className="px-2.5 py-1.5 tabular-nums text-muted">{row.line}</td>
                    <td className="px-2.5 py-1.5">{row.category || <span className="text-danger-text">—</span>}</td>
                    <td className="px-2.5 py-1.5">
                      <div>{row.name.sr || row.name.en || <span className="text-danger-text">—</span>}</div>
                      {row.name.en && row.name.sr ? <div className="text-xs text-muted">{row.name.en}</div> : null}
                      {row.errors.length ? (
                        <ul className="mt-0.5 text-xs text-danger-text">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{row.priceCents !== null ? formatPrice(row.priceCents, currency) : '—'}</td>
                    {isMobile ? null : (
                      <td className="px-2.5 py-1.5 text-xs text-muted">
                        {[...row.allergens, ...row.tags].join(', ')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.invalid ? <p className="text-xs text-muted">Rows with errors are left out; fix them in the file and import again, or import the rest now.</p> : null}
        </div>
      ) : null}
    </div>
  );

  const footer = result ? (
    <Button variant="primary" onClick={onClose}>
      Done
    </Button>
  ) : (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!data || data.valid === 0} loading={importMenu.isPending} onClick={run}>
        {data ? `Import ${data.valid} ${data.valid === 1 ? 'item' : 'items'}` : 'Import'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open onClose={onClose} title="Import from spreadsheet" variant="bottom" footer={<div className="flex justify-end gap-2 px-4 pt-3">{footer}</div>}>
        <div className="pb-3">{body}</div>
      </Sheet>
    );
  }
  return (
    <Modal open onClose={onClose} title="Import from spreadsheet" size="lg" footer={footer}>
      {body}
    </Modal>
  );
}
