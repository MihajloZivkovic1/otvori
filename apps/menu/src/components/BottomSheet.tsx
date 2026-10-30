import { useCallback, useRef, type ReactNode, type TouchEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface Props {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-height class; the item sheet uses 88%, the cart 94% of the viewport. */
  maxHeight?: string;
}

/** How far the handle must be dragged down before lifting the finger closes the sheet. */
export const SHEET_DRAG_CLOSE_PX = 72;

/**
 * Modal bottom sheet: scrim, drag handle, body scroll lock, focus trap, Escape closes.
 *
 * Only the handle strip at the top is draggable: a finger that starts there pulls the sheet down with it and closes it
 * past `SHEET_DRAG_CLOSE_PX` (otherwise it springs back). The content below keeps its native behaviour, so scrolling
 * the sheet and pinch-zooming the page never close it.
 */
export function BottomSheet({ labelledBy, onClose, children, maxHeight = 'max-h-[88%]' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  useLockBodyScroll(true);
  useFocusTrap(sheetRef, onClose);

  const setOffset = (dy: number, animate: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
    sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };

  // A second finger (a pinch) fires touchstart again with two touches, which cancels the drag until every finger is up.
  const onHandleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) {
      dragStartY.current = null;
      setOffset(0, true);
      return;
    }
    dragStartY.current = touch.clientY;
  }, []);
  const onHandleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const start = dragStartY.current;
    const touch = event.touches[0];
    if (start == null || !touch) return;
    setOffset(touch.clientY - start, false);
  }, []);
  const onHandleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const start = dragStartY.current;
      dragStartY.current = null;
      const end = event.changedTouches[0];
      if (start == null || !end || event.touches.length > 0) {
        setOffset(0, true);
        return;
      }
      if (end.clientY - start >= SHEET_DRAG_CLOSE_PX) onClose();
      else setOffset(0, true);
    },
    [onClose],
  );
  const onHandleTouchCancel = useCallback(() => {
    dragStartY.current = null;
    setOffset(0, true);
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="scrim-enter absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`sheet-enter no-scrollbar absolute inset-x-0 bottom-0 mx-auto ${maxHeight} w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface text-ink outline-none`}
      >
        <div
          data-testid="sheet-handle"
          className="sticky top-0 z-10 flex cursor-grab touch-none justify-center bg-surface pt-2.5 pb-3"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchCancel}
        >
          <div className="h-1 w-10 rounded-sm bg-line" />
        </div>
        {children}
      </div>
    </div>
  );
}
