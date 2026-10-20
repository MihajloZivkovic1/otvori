import type { SVGProps } from 'react';

/**
 * The salveta napkin glyph and wordmark, taken from design/salveta.menu website.html.
 * The glyph is a square with a folded top-right corner; the wordmark is lowercase "salveta" in Libre Baskerville 700.
 */
export function NapkinGlyph({ size = 24, fold = '#C98391', ...rest }: SVGProps<SVGSVGElement> & { size?: number; fold?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
      <path d="M3 3h12.5L21 8.5V21H3z" fill="currentColor" />
      <path d="M15.5 3v5.5H21z" fill={fold} />
    </svg>
  );
}

interface WordmarkProps {
  /** Glyph size in px; the text scales with it. */
  size?: number;
  className?: string;
}

export function Wordmark({ size = 24, className = '' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-accent ${className}`}>
      <NapkinGlyph size={size} />
      <span className="font-serif font-bold leading-none tracking-[-.025em]" style={{ fontSize: size }}>
        salveta
      </span>
    </span>
  );
}
