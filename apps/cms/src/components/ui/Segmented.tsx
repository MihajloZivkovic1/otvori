import { cn } from '../../lib/cn';

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Inline segmented control (SR/EN, Light/Dark/Match device, 7/14/30 days). */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-line bg-surface p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-md border-none font-medium transition-colors',
              size === 'sm' ? 'h-[26px] px-2.5 text-xs font-semibold' : 'h-[30px] px-3.5 text-[13px]',
              active ? 'bg-ink text-surface' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
