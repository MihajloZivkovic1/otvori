import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

const REVEAL = 144;

interface SwipeRowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  children: ReactNode;
}

/** Mobile list row that slides left to reveal Edit / Delete (design M3). One row open at a time. */
export function SwipeRow({ open, onOpenChange, disabled, onEdit, onDelete, children }: SwipeRowProps) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; offset: number } | null>(null);
  const dragging = useRef(false);
  const maxReveal = onDelete ? REVEAL : REVEAL / 2;
  const restOffset = open ? -maxReveal : 0;
  const offset = dragOffset ?? restOffset;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    start.current = { x: event.clientX, y: event.clientY, offset: restOffset };
    dragging.current = false;
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (!dragging.current) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragOffset(Math.max(-maxReveal, Math.min(0, start.current.offset + dx)));
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    if (dragging.current) {
      const final = dragOffset ?? restOffset;
      onOpenChange(final < -maxReveal / 2);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } else if (open) {
      onOpenChange(false);
    }
    start.current = null;
    dragging.current = false;
    setDragOffset(null);
  };

  return (
    <div className="relative overflow-hidden border-b border-line-2 bg-surface">
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open}>
        <button type="button" tabIndex={open ? 0 : -1} onClick={onEdit} className="w-[72px] cursor-pointer bg-[#52525B] text-[13px] font-semibold text-white">
          Edit
        </button>
        {onDelete ? (
          <button type="button" tabIndex={open ? 0 : -1} onClick={onDelete} className="w-[72px] cursor-pointer bg-danger text-[13px] font-semibold text-white">
            Delete
          </button>
        ) : null}
      </div>
      <div
        className={cn('relative bg-surface', dragOffset === null && 'transition-transform duration-200')}
        style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {children}
      </div>
    </div>
  );
}
