import { useState } from 'react';
import type { ApplyPosSyncInput, PosSyncPreviewDto } from '@qr-menu/shared';
import { formatPrice } from '../../lib/format';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Props {
  preview: PosSyncPreviewDto | null;
  loading: boolean;
  applying: boolean;
  onClose: () => void;
  onApply: (input: ApplyPosSyncInput) => void;
}

/** "Sync from POS" review: new products (become items) and price changes (update mapped items), each selectable. */
export function PosSyncModal({ preview, loading, applying, onClose, onApply }: Props) {
  const { restaurant } = useRestaurantContext();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const createCodes = preview?.create.filter((p) => !excluded.has(`c:${p.code}`)).map((p) => p.code) ?? [];
  const updateCodes = preview?.update.filter((u) => !excluded.has(`u:${u.code}`)).map((u) => u.code) ?? [];
  const nothing = !preview || (preview.create.length === 0 && preview.update.length === 0);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Sync from the register"
      subtitle="Review before applying. New items land in a hidden “From the register” category; price updates change mapped items only."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={applying} disabled={nothing || (createCodes.length === 0 && updateCodes.length === 0)} onClick={() => onApply({ createCodes, updateCodes })}>
            Apply {createCodes.length + updateCodes.length > 0 ? `(${createCodes.length + updateCodes.length})` : ''}
          </Button>
        </div>
      }
    >
      {loading || !preview ? (
        <div role="status" aria-busy="true" className="py-6 text-center text-[13px] text-muted">
          Reading the register…
        </div>
      ) : (
        <div className="flex flex-col gap-5 text-sm">
          <Group title={`New on the register (${preview.create.length})`} empty="Nothing new.">
            {preview.create.map((product) => (
              <Row key={product.code} id={`c:${product.code}`} checked={!excluded.has(`c:${product.code}`)} onToggle={toggle}>
                <span className="font-medium">{product.name}</span>
                <span className="text-muted">
                  {product.code}
                  {product.group ? ` · ${product.group}` : ''}
                  {product.taxLabel ? ` · ${product.taxLabel}` : ''}
                </span>
                <span className="ml-auto tabular-nums">{formatPrice(product.priceCents, restaurant.currency)}</span>
              </Row>
            ))}
          </Group>
          <Group title={`Price changes (${preview.update.length})`} empty="Every mapped item has the register's price.">
            {preview.update.map((change) => (
              <Row key={change.code} id={`u:${change.code}`} checked={!excluded.has(`u:${change.code}`)} onToggle={toggle}>
                <span className="font-medium">{change.name}</span>
                <span className="text-muted">{change.code}</span>
                <span className="ml-auto tabular-nums">
                  <span className="text-muted line-through">{formatPrice(change.currentPriceCents, restaurant.currency)}</span> → {formatPrice(change.priceCents, restaurant.currency)}
                </span>
              </Row>
            ))}
          </Group>
          {preview.missing.length > 0 ? (
            <p className="text-[13px] text-muted">
              Not on the register any more (left untouched): {preview.missing.map((m) => `${m.name} (${m.code})`).join(', ')}.
            </p>
          ) : null}
          {preview.unmapped > 0 ? <p className="text-[13px] text-muted">{preview.unmapped} menu item{preview.unmapped === 1 ? ' has' : 's have'} no POS code yet.</p> : null}
        </div>
      )}
    </Modal>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{title}</h3>
      {children.length === 0 ? <p className="text-[13px] text-faint">{empty}</p> : <ul className="flex flex-col divide-y divide-line-2 rounded-lg border border-line">{children}</ul>}
    </section>
  );
}

function Row({ id, checked, onToggle, children }: { id: string; checked: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
        <input type="checkbox" checked={checked} onChange={() => onToggle(id)} className="size-4 accent-accent" />
        {children}
      </label>
    </li>
  );
}
