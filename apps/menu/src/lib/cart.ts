import { ORDERING_LIMITS, type PublicMenuCategoryDto } from '@qr-menu/shared';
import { findItem } from './format';

/** One cart line = item + variant + note; the same item with another note is a separate line. */
export interface CartLine {
  key: string;
  itemId: string;
  variantId: string | null;
  quantity: number;
  note: string;
}

/** A cart line priced against the current menu (names and prices are never stored, only ids). */
export interface PricedLine extends CartLine {
  name: string;
  variantName: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  available: boolean;
}

const PREFIX = 'tabla.cart.';

export function lineKey(itemId: string, variantId: string | null, note: string): string {
  return `${itemId}|${variantId ?? ''}|${note}`;
}

function isLine(value: unknown): value is CartLine {
  const line = value as Partial<CartLine> | null;
  return (
    typeof line?.key === 'string' &&
    typeof line.itemId === 'string' &&
    (typeof line.variantId === 'string' || line.variantId === null) &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    typeof line.note === 'string'
  );
}

/** The cart lives per tenant in sessionStorage: it belongs to this visit, not to the device. */
export function readCart(tenantKey: string): CartLine[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PREFIX + tenantKey) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLine).slice(0, ORDERING_LIMITS.maxLines) : [];
  } catch {
    return [];
  }
}

export function writeCart(tenantKey: string, lines: CartLine[]): void {
  try {
    if (lines.length === 0) sessionStorage.removeItem(PREFIX + tenantKey);
    else sessionStorage.setItem(PREFIX + tenantKey, JSON.stringify(lines));
  } catch {
    // storage unavailable: the in-memory cart still works for this page
  }
}

export interface AddInput {
  itemId: string;
  variantId: string | null;
  quantity: number;
  note: string;
}

/** Merge into an identical line (capped at 20) or append (capped at 30 lines). Returns null when the cart is full. */
export function addLine(lines: CartLine[], input: AddInput): CartLine[] | null {
  const note = input.note.trim();
  const key = lineKey(input.itemId, input.variantId, note);
  const existing = lines.find((line) => line.key === key);
  if (existing) {
    const quantity = Math.min(ORDERING_LIMITS.maxQuantity, existing.quantity + input.quantity);
    return lines.map((line) => (line.key === key ? { ...line, quantity } : line));
  }
  if (lines.length >= ORDERING_LIMITS.maxLines) return null;
  const quantity = Math.max(1, Math.min(ORDERING_LIMITS.maxQuantity, input.quantity));
  return [...lines, { key, itemId: input.itemId, variantId: input.variantId, quantity, note }];
}

/** Quantity 0 removes the line. */
export function setLineQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.key !== key);
  const capped = Math.min(ORDERING_LIMITS.maxQuantity, quantity);
  return lines.map((line) => (line.key === key ? { ...line, quantity: capped } : line));
}

/** Resolve names and prices from the menu; lines whose item (or variant) disappeared from the menu are dropped. */
export function priceCart(lines: CartLine[], categories: PublicMenuCategoryDto[]): PricedLine[] {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const item = findItem(categories, line.itemId);
    if (!item) continue;
    const variant = line.variantId ? item.variants.find((v) => v.id === line.variantId) : null;
    if (line.variantId && !variant) continue;
    const unitPriceCents = variant?.priceCents ?? item.priceCents;
    priced.push({
      ...line,
      name: item.name,
      variantName: variant?.name ?? null,
      unitPriceCents,
      lineTotalCents: unitPriceCents * line.quantity,
      available: item.isAvailable,
    });
  }
  return priced;
}

export function cartCount(lines: ReadonlyArray<Pick<CartLine, 'quantity'>>): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartTotal(lines: ReadonlyArray<PricedLine>): number {
  return lines.reduce((sum, line) => sum + (line.available ? line.lineTotalCents : 0), 0);
}
