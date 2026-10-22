import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '../../components/Wordmark';

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Centred 360px column (desktop) / full-width phone layout (M1) with the otvori wordmark. */
export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <div className="flex flex-1 flex-col justify-center px-6 py-10 tab:items-center">
        <div className="flex w-full flex-col gap-6 tab:w-[360px] tab:gap-7">
          <Link to="/login" className="flex items-center no-underline" aria-label="otvori">
            <Wordmark size={26} />
          </Link>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold leading-tight tracking-[-.01em] tab:text-[22px]">{title}</h1>
            {subtitle ? <p className="text-muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
      {footer ? <div className="px-6 pb-10 text-center text-[13px] text-muted tab:pb-12">{footer}</div> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger-line bg-[#fef2f2] px-3 py-2 text-[13px] text-danger-text">
      {message}
    </div>
  );
}
