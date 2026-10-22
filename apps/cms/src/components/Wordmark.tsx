import type { SVGProps } from 'react';

/**
 * The otvori mark and wordmark, taken from design/otvori-brand.html.
 * The mark is a QR finder square whose right side has swung open toward the viewer (a door, a menu opening):
 * 32-unit grid, frame stroke 3.2, inner square 8, door hinged at x=24.5. The wordmark is lowercase "otvori"
 * in Libre Baskerville 400; in the lockup the mark is 1.125× the font size.
 */
export function OtvoriMark({ size = 24, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...rest}>
      <path d="M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <rect x="11.3" y="12" width="8" height="8" rx="1.5" fill="currentColor" />
      <path d="M24.5 6.4 30 2.2v27.6l-5.5-4.2z" fill="currentColor" />
    </svg>
  );
}

interface WordmarkProps {
  /** Wordmark font size in px; the mark scales with it. */
  size?: number;
  className?: string;
}

export function Wordmark({ size = 24, className = '' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center text-accent ${className}`} style={{ gap: Math.round(size * 0.4) }}>
      <OtvoriMark size={Math.round(size * 1.125)} />
      <span className="font-serif leading-none tracking-[-.02em]" style={{ fontSize: size }}>
        otvori
      </span>
    </span>
  );
}
