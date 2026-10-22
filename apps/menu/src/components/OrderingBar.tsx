import type { ServiceRequestType } from '@qr-menu/shared';
import type { Dictionary } from '../lib/i18n';
import { BellIcon, CheckIcon, PauseIcon, ReceiptIcon } from './icons';

interface Props {
  t: Dictionary;
  /** Seconds left of the cooldown per request type (0 = ready). */
  remaining: Record<ServiceRequestType, number>;
  onCall: (type: ServiceRequestType) => void;
  /** Shown above the buttons while ordering is paused (order mode only). */
  paused?: { message: string | null } | null;
}

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "Call the waiter" / "The bill" with a 60 s cooldown and the "waiter notified" chip; optional paused banner. */
export function OrderingBar({ t, remaining, onCall, paused = null }: Props) {
  const notified = remaining.call_waiter > 0 || remaining.bill > 0;
  const button = (type: ServiceRequestType, icon: React.ReactNode, label: string, className: string) => {
    const seconds = remaining[type];
    const cooling = seconds > 0;
    return (
      <button
        type="button"
        disabled={cooling}
        onClick={() => onCall(type)}
        aria-live={cooling ? 'off' : undefined}
        className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold tabular-nums ${className} ${
          cooling ? 'border-transparent bg-chip text-muted' : 'border-line bg-surface text-ink'
        }`}
      >
        {cooling ? <CheckIcon /> : icon}
        <span>{cooling ? `${t.called} · ${countdown(seconds)}` : label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      {paused && (
        <div role="status" className="flex items-start gap-3 rounded-[14px] border border-line bg-chip px-4 py-3.5">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-surface text-accent" aria-hidden="true">
            <PauseIcon />
          </span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-sm leading-[1.3] font-semibold">{t.paused}</span>
            <span className="text-[13px] leading-[1.45] text-muted text-pretty">{paused.message ?? t.pausedDefault}</span>
          </span>
        </div>
      )}
      <div className="flex gap-2">
        {button('call_waiter', <BellIcon />, t.callWaiter, 'flex-1')}
        {button('bill', <ReceiptIcon />, t.bill, 'min-w-[112px] flex-none px-4')}
      </div>
      {notified && (
        <span className="inline-flex h-7 w-fit items-center gap-2 rounded-full bg-ok-soft px-3 text-xs font-semibold text-ok">
          <span className="pulse-dot size-[7px] rounded-full bg-ok" aria-hidden="true" />
          {t.waiterNotified}
        </span>
      )}
    </div>
  );
}
