/** Drop keys whose value is undefined so PATCH payloads only touch provided fields. */
export function definedOnly<T extends object>(input: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
}

export function toIso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}
