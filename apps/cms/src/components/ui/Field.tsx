import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, stacked with the design's 6px gap. */
export function Field({ label, htmlFor, hint, error, trailing, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-danger-text">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-faint">{hint}</span>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full border border-line bg-surface text-ink placeholder:text-faint disabled:bg-line-2 disabled:text-muted aria-invalid:border-danger';

export type ControlSize = 'md' | 'lg';
const INPUT_SIZE: Record<ControlSize, string> = {
  md: 'h-10 rounded-lg px-3 text-sm',
  lg: 'h-12 rounded-[10px] px-3.5 text-base',
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { controlSize = 'md', invalid, className, ...rest },
  ref,
) {
  return (
    <input ref={ref} aria-invalid={invalid || undefined} className={cn(CONTROL, INPUT_SIZE[controlSize], className)} {...rest} />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { controlSize = 'md', invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'resize-y leading-[1.45]',
        controlSize === 'lg' ? 'rounded-[10px] px-3.5 py-3 text-base' : 'rounded-lg px-3 py-2.5 text-sm',
        className,
      )}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  controlSize?: ControlSize;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { controlSize = 'md', invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, INPUT_SIZE[controlSize], 'appearance-none bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2371717A' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 12px center',
        backgroundSize: '14px 14px',
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

interface AffixInputProps extends InputProps {
  suffix: ReactNode;
}

/** Input with a trailing unit cell ("RSD"), drawn as one bordered control. */
export const AffixInput = forwardRef<HTMLInputElement, AffixInputProps>(function AffixInput(
  { suffix, controlSize = 'md', invalid, className, ...rest },
  ref,
) {
  const large = controlSize === 'lg';
  return (
    <div
      className={cn(
        'flex items-center overflow-hidden border border-line bg-surface',
        large ? 'h-12 rounded-[10px]' : 'h-10 rounded-lg',
        invalid && 'border-danger',
        className,
      )}
    >
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-full min-w-0 flex-1 border-none bg-transparent text-ink tabular-nums outline-none placeholder:text-faint',
          large ? 'px-3.5 text-base' : 'px-3 text-sm',
        )}
        {...rest}
      />
      <span
        className={cn(
          'flex h-full items-center border-l border-line text-muted',
          large ? 'px-3.5 text-sm' : 'px-3 text-[13px]',
        )}
      >
        {suffix}
      </span>
    </div>
  );
});
