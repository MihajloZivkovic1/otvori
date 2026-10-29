import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface MenuItemDef {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Why it is disabled; shown as the tooltip. */
  reason?: string;
}

interface MenuProps {
  items: MenuItemDef[];
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string }) => ReactNode;
  align?: 'left' | 'right';
}

/** Minimal dropdown menu (row "More" actions). Closes on outside click, Escape and selection. */
export function Menu({ items, trigger, align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': id })}
      {open ? (
        <div
          id={id}
          role="menu"
          className={cn(
            'pop-enter absolute top-full z-30 mt-1 min-w-[160px] rounded-[10px] border border-line bg-surface p-1 shadow-[0_8px_30px_rgba(0,0,0,.12)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.reason : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex h-9 w-full cursor-pointer items-center rounded-md px-2.5 text-left text-[13px] font-medium hover:bg-line-2 disabled:cursor-default disabled:opacity-50',
                item.danger ? 'text-danger-text' : 'text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
