import type { Dictionary } from '../lib/i18n';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  t: Dictionary;
  /** Accessible name of what is being counted ("Flat white"). */
  label: string;
  size?: 'md' | 'sm';
}

/** − value + with 44px targets; `min` 0 lets the cart remove a line. */
export function Stepper({ value, min, max, onChange, t, label, size = 'md' }: Props) {
  const button = 'grid size-11 place-items-center text-ink disabled:opacity-35';
  return (
    <div
      role="group"
      aria-label={`${t.quantity}: ${label}`}
      className={`flex flex-none items-center overflow-hidden border border-line ${size === 'md' ? 'rounded-xl' : 'rounded-[10px]'}`}
    >
      <button type="button" aria-label={`${t.decrease}: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={`${button} ${size === 'md' ? 'text-xl' : 'text-lg'}`}>
        −
      </button>
      <span aria-live="polite" className={`text-center font-semibold tabular-nums ${size === 'md' ? 'min-w-9 text-base' : 'min-w-6 text-[15px]'}`}>
        {value}
      </span>
      <button type="button" aria-label={`${t.increase}: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={`${button} ${size === 'md' ? 'text-xl' : 'text-lg'}`}>
        +
      </button>
    </div>
  );
}
