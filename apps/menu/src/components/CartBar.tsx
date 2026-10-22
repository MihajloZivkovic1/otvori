import { formatPrice } from '../lib/format';
import type { Dictionary, UiLocale } from '../lib/i18n';

interface Props {
  count: number;
  totalCents: number;
  currency: string;
  locale: UiLocale;
  t: Dictionary;
  onOpen: () => void;
}

/** Fixed accent bar at the bottom: item count, "View cart", total. */
export function CartBar({ count, totalCents, currency, locale, t, onOpen }: Props) {
  return (
    <div className="safe-bottom-bar pointer-events-none fixed inset-x-4 z-30 mx-auto max-w-[608px]">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto flex h-14 w-full items-center justify-between rounded-2xl bg-accent px-[18px] text-[15px] font-semibold text-on-accent shadow-[0_10px_30px_rgba(31,26,23,.28)]"
      >
        <span className="flex items-center gap-2.5">
          <span className="inline-grid h-6 min-w-6 place-items-center rounded-xl bg-white/20 px-[7px] text-[13px] font-semibold tabular-nums">{count}</span>
          {t.viewCart}
        </span>
        <span className="tabular-nums">{formatPrice(totalCents, currency, locale)}</span>
      </button>
    </div>
  );
}
