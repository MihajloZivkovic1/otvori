import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'danger-ghost' | 'accent-text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'mobile';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent font-semibold hover:brightness-95 disabled:opacity-50',
  secondary: 'border border-line bg-surface text-ink font-medium hover:bg-line-2 disabled:opacity-50',
  ghost: 'bg-transparent text-ink-2 font-medium hover:bg-line-2 disabled:opacity-50',
  danger: 'border border-danger-line bg-surface text-danger-text font-medium hover:bg-[#fef2f2] disabled:opacity-50',
  'danger-solid': 'bg-danger-text text-white font-semibold hover:brightness-95 disabled:opacity-50',
  'danger-ghost': 'bg-transparent text-danger-text font-medium hover:bg-[#fef2f2] disabled:opacity-50',
  'accent-text': 'bg-transparent text-accent font-semibold text-[15px] disabled:opacity-50',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-9 px-3.5 text-[13px] rounded-lg',
  lg: 'h-10 px-4 text-sm rounded-lg',
  xl: 'h-11 px-4 text-sm rounded-[10px]',
  mobile: 'h-12 px-5 text-base rounded-[10px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:cursor-default',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 28 | 32 | 36 | 44;
  variant?: 'ghost' | 'outline';
}

/** Square icon-only button; `label` becomes the accessible name and the tooltip. */
export function IconButton({ label, size = 32, variant = 'ghost', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'grid shrink-0 cursor-pointer place-items-center rounded-md transition-colors disabled:cursor-default disabled:opacity-50',
        variant === 'outline' ? 'border border-line bg-surface text-ink-2 hover:bg-line-2' : 'text-muted hover:bg-line-2 hover:text-ink',
        size === 28 && 'size-7',
        size === 32 && 'size-8',
        size === 36 && 'size-9',
        size === 44 && 'size-11',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
