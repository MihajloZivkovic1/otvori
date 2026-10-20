const TAG_CLASS: Record<string, string> = { vegan: 'tag-vegan', spicy: 'tag-spicy', new: 'tag-new' };

export function TagChip({ tag, label, size = 'sm' }: { tag: string; label: string; size?: 'sm' | 'md' }) {
  const dims = size === 'md' ? 'h-[22px] px-[9px]' : 'h-5 px-2';
  return (
    <span className={`${TAG_CLASS[tag] ?? 'tag-default'} ${dims} inline-flex items-center rounded-full text-[11px] font-semibold tracking-[0.03em] uppercase`}>
      {label}
    </span>
  );
}

/** Allergen code in a small ring; the full name is exposed to assistive tech and as a tooltip. */
export function AllergenGlyph({ code, name }: { code: string; name: string }) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className="inline-grid size-5 flex-none place-items-center rounded-full border border-line text-[10px] font-semibold text-muted"
    >
      {code}
    </span>
  );
}

export function TableChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-chip px-3 text-xs font-semibold tracking-[0.02em] text-ink">
      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
      {label}
    </span>
  );
}
