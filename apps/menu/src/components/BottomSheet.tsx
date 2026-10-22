import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface Props {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-height class; the item sheet uses 88%, the cart 94% of the viewport. */
  maxHeight?: string;
}

/** Modal bottom sheet: scrim, drag handle, body scroll lock, focus trap, Escape closes. */
export function BottomSheet({ labelledBy, onClose, children, maxHeight = 'max-h-[88%]' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll(true);
  useFocusTrap(sheetRef, onClose);

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
        <div className="sticky top-0 z-10 flex justify-center bg-surface pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-sm bg-line" />
        </div>
        {children}
      </div>
    </div>
  );
}
