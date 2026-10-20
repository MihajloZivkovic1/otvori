/** Ids of the landing sections, in page order, that the language switch can land on. */
export const SECTION_IDS = ['kako', 'dobijas', 'cene', 'pitanja'] as const;

/** The section whose top has scrolled past `scrollTop` (+ a header offset), or null above the first one. */
export function currentSection(
  sectionTops: { id: string; top: number }[],
  scrollTop: number,
  offset = 80,
): string | null {
  let current: string | null = null;
  for (const { id, top } of sectionTops) {
    if (top <= scrollTop + offset) current = id;
  }
  return current;
}

/** `/en/` + `#cene` → `/en/#cene`; keeps the user on the same section after switching language. */
export function switchHref(basePath: string, sectionId: string | null): string {
  return sectionId ? `${basePath}#${sectionId}` : basePath;
}

export function initLangSwitch(root: ParentNode): void {
  const link = root.querySelector<HTMLAnchorElement>('[data-lang-switch]');
  if (!link) return;
  const base = link.getAttribute('href') ?? '/';
  link.addEventListener('click', () => {
    const tops = SECTION_IDS.flatMap((id) => {
      const el = root.querySelector<HTMLElement>(`#${id}`);
      return el ? [{ id, top: el.getBoundingClientRect().top + window.scrollY }] : [];
    });
    link.href = switchHref(base, currentSection(tops, window.scrollY));
  });
}
