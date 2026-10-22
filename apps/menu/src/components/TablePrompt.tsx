import { useId, useState, type FormEvent } from 'react';
import type { Dictionary } from '../lib/i18n';
import { parseTableNumber } from '../lib/session';
import { BottomSheet } from './BottomSheet';

interface Props {
  t: Dictionary;
  onConfirm: (tableNumber: number) => void;
  onClose: () => void;
}

/** Asks for the table number when the menu was opened without one (calling the waiter needs it). */
export function TablePrompt({ t, onConfirm, onClose }: Props) {
  const titleId = useId();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const number = parseTableNumber(value);
    if (number === null) {
      setError(t.tableRequired);
      return;
    }
    onConfirm(number);
  };

  return (
    <BottomSheet labelledBy={titleId} onClose={onClose} maxHeight="max-h-[70%]">
      <form onSubmit={submit} noValidate className="safe-bottom flex flex-col gap-4 px-5 pt-2">
        <h2 id={titleId} className="font-serif text-2xl leading-[1.2] font-bold">
          {t.tableNumber}
        </h2>
        <p className="text-[13px] leading-[1.45] text-muted text-pretty">{t.tableHelp}</p>
        <label htmlFor={inputId} className="sr-only">
          {t.tableNumber}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="7"
          autoFocus
          aria-invalid={error ? true : undefined}
          className="h-12 rounded-xl border border-accent bg-transparent px-3.5 text-center text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-[13px] text-bad">
            {error}
          </p>
        )}
        <button type="submit" className="h-[52px] rounded-[14px] bg-accent text-base font-semibold text-on-accent">
          {t.confirm}
        </button>
      </form>
    </BottomSheet>
  );
}
