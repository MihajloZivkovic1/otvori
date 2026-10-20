import { env } from '../config/env.js';

/** Public menu URL for a restaurant, optionally for a specific table (its QR code encodes `/t/<number>`). */
export function buildMenuUrl(slug: string, tableNumber?: number | null): string {
  const base = env.publicMenu.template.replaceAll('{slug}', slug).replace(/\/+$/, '');
  if (tableNumber == null) return base;
  return `${base}/t/${tableNumber}`;
}
