import { RESTAURANT_DEFAULTS, type Theme } from '@qr-menu/shared';

/**
 * Theming: restaurant.theme picks light / dark / auto (device preference). The tenant accent (primaryColor)
 * is exposed as --accent-light together with a readable text color; styles.css derives the dark-surface
 * accent from it in CSS (OKLCH relative color, see the @supports block) so the burgundy of the design turns
 * into the same dusty pink the dark frame uses.
 */

const WHITE = '#FFFFFF';
const DARK_INK = '#1B1816';

export function normalizeHex(input: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input?.trim() ?? '');
  return match ? `#${match[1]!.toUpperCase()}` : null;
}

/** WCAG relative luminance (0 = black, 1 = white) of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const c = ((n >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text color with the better contrast on the given background: white below ~20% luminance, dark ink above. */
export function readableOn(hex: string): string {
  return relativeLuminance(hex) <= 0.2 ? WHITE : DARK_INK;
}

export function normalizeTheme(theme: string | null | undefined): Theme {
  return theme === 'dark' || theme === 'auto' ? theme : 'light';
}

export function applyTheme(theme: string | null | undefined, primaryColor: string | null | undefined): void {
  const root = document.documentElement;
  const mode = normalizeTheme(theme);
  if (mode === 'auto') delete root.dataset.theme;
  else root.dataset.theme = mode;

  const accent = normalizeHex(primaryColor) ?? RESTAURANT_DEFAULTS.primaryColor;
  root.style.setProperty('--accent-light', accent);
  root.style.setProperty('--on-accent-light', readableOn(accent));
}
