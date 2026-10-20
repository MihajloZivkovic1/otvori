import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '../../lib/cn';
import { centsToInput, inputToCents } from '../../lib/format';
import { AffixInput, type ControlSize } from '../ui/Field';

interface PriceInputProps {
  /** Minor units; NaN while the typed text is not a number. */
  value: number | undefined;
  onChange: (cents: number) => void;
  onBlur?: () => void;
  currency: string;
  controlSize?: ControlSize;
  invalid?: boolean;
  id?: string;
  /** bare = borderless cell inside the variants table. */
  variant?: 'affix' | 'bare';
  placeholder?: string;
  'aria-label'?: string;
}

/** Shows prices in major units ("290", "1.290,50") and emits minor units to the form. */
export function PriceInput({ value, onChange, onBlur, currency, controlSize = 'md', invalid, id, variant = 'affix', placeholder = '0', ...aria }: PriceInputProps) {
  const [textValue, setTextValue] = useState(() => centsToInput(Number.isFinite(value) ? value : null));
  const lastEmitted = useRef<number | undefined>(value);

  useEffect(() => {
    if (!Object.is(value, lastEmitted.current)) {
      lastEmitted.current = value;
      setTextValue(centsToInput(Number.isFinite(value) ? value : null));
    }
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setTextValue(next);
    const cents = inputToCents(next);
    const emitted = cents ?? Number.NaN;
    lastEmitted.current = emitted;
    onChange(emitted);
  };

  if (variant === 'bare') {
    return (
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={textValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-8 min-w-0 rounded-md border bg-transparent px-2.5 text-[13px] tabular-nums text-ink placeholder:text-faint focus:border-line focus:bg-surface',
          invalid ? 'border-danger' : 'border-transparent',
        )}
        {...aria}
      />
    );
  }

  return (
    <AffixInput
      id={id}
      type="text"
      inputMode="decimal"
      value={textValue}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      suffix={currency}
      controlSize={controlSize}
      invalid={invalid}
      {...aria}
    />
  );
}

/** Friendlier wording for zod's number errors on price fields. */
export function priceError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (/nan|expected number|received undefined|invalid input/i.test(message)) return 'Enter a price';
  if (/integer/i.test(message)) return 'Use at most two decimals';
  if (/>=\s*0|too small/i.test(message)) return 'Price cannot be negative';
  return message;
}
