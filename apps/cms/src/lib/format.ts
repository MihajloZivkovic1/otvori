import type { TranslatedText } from '@qr-menu/shared';
import { resolveText } from '@qr-menu/shared';

const NBSP = ' ';
const number = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 2 });

/** Minor units → "290 RSD" / "1.290,50 RSD" (amount first, currency last, as in the guest menu). */
export function formatPrice(cents: number, currency: string): string {
  return `${number.format(cents / 100)}${NBSP}${currency}`;
}

/** Minor units → the string shown in a price input ("290", "290,5"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  const major = cents / 100;
  return Number.isInteger(major) ? String(major) : String(major).replace('.', ',');
}

/** Price input ("290", "1 290,50", "290.5") → minor units, or null when not a number. */
export function inputToCents(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  if (normalized === '') return null;
  const major = Number(normalized);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/** Pick the text to show in the CMS: default locale, then any other translation. */
export function text(value: TranslatedText | null | undefined, defaultLocale: string): string {
  return resolveText(value, defaultLocale, defaultLocale === 'sr' ? 'en' : 'sr');
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'T';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "12 min ago", "1 h ago", "Yesterday", "3 days ago", "12 Oct". */
export function relativeTime(iso: string | null, now = new Date()): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((startOfToday.getTime() - date.getTime()) / 86_400_000);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return shortDate(iso);
}

/** "Today, 09:12", "Yesterday", "3 days ago", "12 Oct" (superadmin "last edited" column). */
export function editedAt(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `Today, ${hh}:${mm}`;
  }
  return relativeTime(iso, now);
}

export function daysLeft(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}

export function percent(delta: number | null): string {
  if (delta === null) return 'No previous data';
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}% vs previous period`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** "13:31" (device time; the staff phone is in the venue). */
export function clock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Minutes until an order expires (0 once it is due). */
export function minutesUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000));
}

/** "1:40" for a median of 100 seconds; "—" when unknown. */
export function minutesSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
