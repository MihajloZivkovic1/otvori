import { useCallback, useEffect, useRef, useState } from 'react';

export function sectionDomId(categoryId: string): string {
  return `cat-${categoryId}`;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tracks which category section sits under the sticky chip bar (IntersectionObserver) and scrolls to a
 * section on demand. While a programmatic scroll is in flight the observer is ignored so the tapped chip
 * does not flicker through the categories it passes.
 */
export function useActiveCategory(ids: readonly string[], topOffset: number) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const lockUntil = useRef(0);
  const intersecting = useRef(new Map<string, boolean>());
  const pickRef = useRef<() => void>(() => undefined);

  // A stale id (the category list changed underneath) falls back to the first category without a state write.
  const current = active && ids.includes(active) ? active : (ids[0] ?? null);

  useEffect(() => {
    intersecting.current = new Map();
    if (typeof IntersectionObserver === 'undefined' || ids.length === 0) return;

    const pick = () => {
      if (Date.now() < lockUntil.current) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight > window.innerHeight + 2;
      if (scrollable && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        setActive(ids[ids.length - 1] ?? null); // short last section: reaching the bottom selects it
        return;
      }
      const first = ids.find((id) => intersecting.current.get(id));
      if (first) setActive(first);
    };
    pickRef.current = pick;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.categoryId;
          if (id) intersecting.current.set(id, entry.isIntersecting);
        }
        pick();
      },
      // Activation band: from just below the sticky bar to ~45% down the viewport.
      { rootMargin: `-${topOffset}px 0px -55% 0px`, threshold: 0 },
    );
    for (const id of ids) {
      const element = document.getElementById(sectionDomId(id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids, topOffset]);

  const scrollTo = useCallback((id: string) => {
    const element = document.getElementById(sectionDomId(id));
    if (!element) return;
    setActive(id);
    const reduce = prefersReducedMotion();
    lockUntil.current = Date.now() + (reduce ? 150 : 800);
    element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(
      () => {
        lockUntil.current = 0;
        pickRef.current();
      },
      reduce ? 200 : 850,
    );
  }, []);

  return { active: current, scrollTo };
}
