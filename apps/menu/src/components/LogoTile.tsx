function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? 'T';
}

/** 44px logo tile; falls back to the restaurant's initial on the accent color. */
export function LogoTile({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={44}
        height={44}
        decoding="async"
        className="size-11 flex-none rounded-xl bg-placeholder object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="grid size-11 flex-none place-items-center rounded-xl bg-accent font-serif text-lg font-bold text-on-accent"
    >
      {initialOf(name)}
    </div>
  );
}
