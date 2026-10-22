import { useId, useState, type FormEvent } from 'react';
import { ORDERING_LIMITS } from '@qr-menu/shared';
import type { PricedLine } from '../lib/cart';
import { cartCount, cartTotal } from '../lib/cart';
import { formatPrice } from '../lib/format';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { parseTableNumber } from '../lib/session';
import { BottomSheet } from './BottomSheet';
import { Stepper } from './Stepper';

export interface CartSubmission {
  note: string;
  guestName: string;
  tableNumber: number;
}
export type SubmitResult = { ok: true } | { ok: false; message: string; field?: 'table' };

interface Props {
  lines: PricedLine[];
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  /** Known from the QR code; null shows the inline table field. */
  tableNumber: number | null;
  onChangeQuantity: (key: string, quantity: number) => void;
  onSubmit: (submission: CartSubmission) => Promise<SubmitResult>;
  onClose: () => void;
}

const LABEL = 'text-xs font-semibold tracking-[0.06em] text-muted uppercase';
const FIELD = 'rounded-xl border bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none';

/** The cart (design A3): steppers, note for the waiter, optional name, table number when unknown, "Send to waiter". */
export function CartSheet({ lines, currency, locale, t, tableNumber, onChangeQuantity, onSubmit, onClose }: Props) {
  const titleId = useId();
  const noteId = useId();
  const nameId = useId();
  const tableId = useId();
  const [note, setNote] = useState('');
  const [guestName, setGuestName] = useState('');
  const [table, setTable] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; field?: 'table' } | null>(null);
  const available = lines.filter((line) => line.available);
  const count = cartCount(available);
  const total = cartTotal(lines);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const resolvedTable = tableNumber ?? parseTableNumber(table);
    if (resolvedTable === null) {
      setError({ message: t.tableRequired, field: 'table' });
      return;
    }
    if (available.length === 0) return;
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({ note: note.trim(), guestName: guestName.trim(), tableNumber: resolvedTable });
    setSubmitting(false);
    if (!result.ok) setError({ message: result.message, field: result.field });
  };

  return (
    <BottomSheet labelledBy={titleId} onClose={onClose} maxHeight="max-h-[94%]">
      <form onSubmit={(event) => void submit(event)} noValidate className="safe-bottom flex flex-col gap-5 px-5 pt-2">
        <div className="flex items-baseline justify-between">
          <h2 id={titleId} className="font-serif text-2xl leading-[1.2] font-bold">
            {t.cart}
          </h2>
          <span className="text-[13px] text-muted">{t.itemCount(count)}</span>
        </div>

        {lines.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-muted">{t.emptyCart}</p>
        ) : (
          <ul>
            {lines.map((line) => (
              <li key={line.key} className={`flex items-center gap-3 border-b border-line py-3 ${line.available ? '' : 'opacity-45'}`}>
                <Stepper
                  value={line.quantity}
                  min={0}
                  max={ORDERING_LIMITS.maxQuantity}
                  onChange={(quantity) => onChangeQuantity(line.key, quantity)}
                  t={t}
                  label={line.name}
                  size="sm"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-serif text-base leading-[1.25]">{line.name}</span>
                  {line.variantName && <span className="text-[13px] text-muted">{line.variantName}</span>}
                  {line.note && <span className="text-[13px] text-muted italic">“{line.note}”</span>}
                  {!line.available && <span className="text-xs font-medium text-muted italic">{t.unavailable}</span>}
                </span>
                <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums">{formatPrice(line.lineTotalCents, currency, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor={noteId} className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <span className={LABEL}>{t.orderNote}</span>
            <span className="text-xs text-muted tabular-nums">
              {note.length}/{ORDERING_LIMITS.orderNoteMax}
            </span>
          </span>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, ORDERING_LIMITS.orderNoteMax))}
            maxLength={ORDERING_LIMITS.orderNoteMax}
            rows={2}
            placeholder={t.orderNotePlaceholder}
            className={`${FIELD} resize-none border-line px-3.5 py-3 leading-[1.4]`}
          />
        </label>

        <div className={`grid gap-3 ${tableNumber === null ? 'grid-cols-[1fr_112px]' : 'grid-cols-1'}`}>
          <label htmlFor={nameId} className="flex min-w-0 flex-col gap-2">
            <span className={LABEL}>{t.guestName}</span>
            <input
              id={nameId}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value.slice(0, ORDERING_LIMITS.guestNameMax))}
              maxLength={ORDERING_LIMITS.guestNameMax}
              autoComplete="given-name"
              placeholder={t.guestNamePlaceholder}
              className={`${FIELD} h-12 min-w-0 border-line px-3.5`}
            />
          </label>
          {tableNumber === null && (
            <label htmlFor={tableId} className="flex flex-col gap-2">
              <span className={`${LABEL} text-accent`}>{t.tableNumber}</span>
              <input
                id={tableId}
                value={table}
                onChange={(event) => setTable(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="7"
                aria-invalid={error?.field === 'table' ? true : undefined}
                className={`${FIELD} h-12 border-accent px-3.5 text-center`}
              />
            </label>
          )}
        </div>
        {tableNumber === null && <p className="-mt-2.5 text-xs leading-[1.4] text-muted">{t.tableHelp}</p>}

        {error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-[1.45] text-bad text-pretty">
            {error.message}
          </p>
        )}

        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm font-semibold text-muted">{t.total}</span>
          <span className="text-[22px] font-bold tabular-nums">{formatPrice(total, currency, locale)}</span>
        </div>
        <button
          type="submit"
          disabled={submitting || available.length === 0}
          className="h-[52px] rounded-[14px] bg-accent text-base font-semibold text-on-accent disabled:opacity-60"
        >
          {submitting ? t.sending : t.send}
        </button>
        <p className="-mt-2 text-center text-[13px] leading-[1.45] text-muted text-pretty">{t.payNote}</p>
      </form>
    </BottomSheet>
  );
}
