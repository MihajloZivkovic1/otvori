import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type SwitchSize = 'sm' | 'md' | 'lg';

const TRACK: Record<SwitchSize, string> = { sm: 'h-5 w-9', md: 'h-6 w-10', lg: 'h-7 w-12' };
const THUMB: Record<SwitchSize, string> = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
const ON_LEFT: Record<SwitchSize, number> = { sm: 18, md: 18, lg: 22 };

/** Presentational track + thumb (used inside larger tappable rows where a nested button is not allowed). */
export function SwitchTrack({ checked, size = 'md', className }: { checked: boolean; size?: SwitchSize; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-block shrink-0 rounded-full transition-colors',
        TRACK[size],
        checked ? 'bg-accent' : size === 'lg' ? 'bg-line' : 'bg-line-strong',
        className,
      )}
    >
      <span
        className={cn('absolute top-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-150', THUMB[size])}
        style={{ left: checked ? ON_LEFT[size] : 2 }}
      />
    </span>
  );
}

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: SwitchSize;
  label: string;
}

/** The design's pill switch: accent when on, neutral line when off; `label` is the accessible name. */
export function Switch({ checked, onChange, size = 'md', label, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn('inline-grid shrink-0 cursor-pointer place-items-center border-none bg-transparent p-0 disabled:cursor-default disabled:opacity-60', className)}
      {...rest}
    >
      <SwitchTrack checked={checked} size={size} />
    </button>
  );
}
