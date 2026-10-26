/**
 * Small color helpers shared by the guest menu (theme tokens) and the CMS (branding preview + validation).
 * Everything works on `#rrggbb` strings; nothing here depends on the DOM.
 */

const DEFAULT_LIGHT_BACKGROUND = '#F7F2EB';
const LIGHT_INK = '#1F1A17';

export function normalizeHexColor(input: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input?.trim() ?? '');
  return match ? `#${match[1]!.toUpperCase()}` : null;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** WCAG relative luminance (0 = black, 1 = white) of a #rrggbb color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `amount` (0–1) of `to` blended into `from`, in sRGB. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
}

/** Light enough for the dark ink of the light appearance (≈ the top third of the luminance range). */
export function isLightBackground(hex: string): boolean {
  const normalized = normalizeHexColor(hex);
  return normalized !== null && relativeLuminance(normalized) >= 0.6;
}

export interface LightSurfaces {
  bg: string;
  surface: string;
  chip: string;
  placeholder: string;
}

/**
 * Surfaces of the light appearance for a custom page background. The default cream keeps the hand-tuned values
 * of the design; any other background derives the card, chip and image-placeholder tones from itself so a pure
 * white menu gets white cards and soft grey chips instead of cream ones.
 */
export function lightSurfaces(backgroundColor: string | null | undefined): LightSurfaces {
  const bg = normalizeHexColor(backgroundColor) ?? DEFAULT_LIGHT_BACKGROUND;
  if (bg === DEFAULT_LIGHT_BACKGROUND) return { bg, surface: '#FFFDF9', chip: '#EEE6DB', placeholder: '#E8DCCB' };
  return {
    bg,
    surface: mixHex(bg, '#FFFFFF', 0.6),
    chip: mixHex(bg, LIGHT_INK, 0.06),
    placeholder: mixHex(bg, LIGHT_INK, 0.1),
  };
}
