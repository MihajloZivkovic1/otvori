import { useEffect, useRef } from 'react';
import type { Dictionary } from '../lib/i18n';

interface Props {
  categories: readonly { id: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  t: Dictionary;
}

/** Sticky, horizontally scrollable category chips. 44px hit area around a 40px pill. */
export function CategoryBar({ categories, activeId, onSelect, t }: Props) {
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !activeId || typeof bar.scrollTo !== 'function') return;
    const chip = Array.from(bar.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.categoryChip === activeId,
    );
    if (!chip || chip === bar.firstElementChild) return; // first chip: nothing to center, skip the layout read
    const left = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activeId]);

  return (
    <nav
      ref={barRef}
      aria-label={t.categories}
      className="bar-glass no-scrollbar sticky top-0 z-20 flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2"
    >
      {categories.map((category) => {
        const active = category.id === activeId;
        return (
          <button
            key={category.id}
            type="button"
            data-category-chip={category.id}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(category.id)}
            className="h-11 flex-none rounded-full py-0.5"
          >
            <span
              className={`flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap ${
                active ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink'
              }`}
            >
              {category.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
