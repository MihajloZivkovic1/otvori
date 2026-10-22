import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { PAYMENT_LIMITS, tipCentsFor, type PublicOrderDto, type PublicPaymentDto } from '@qr-menu/shared';
import { createPayment, fetchPayment, orderingErrorMessage } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { Dictionary, UiLocale } from '../lib/i18n';
import { BottomSheet } from './BottomSheet';
import { CheckIcon } from './icons';
import { QrCode } from './QrCode';

interface Props {
  slug: string | null;
  order: PublicOrderDto;
  locale: UiLocale;
  t: Dictionary;
  onClose: () => void;
  /** The order became paid (the sheet shows the success state; the page refetches the order). */
  onPaid: () => void;
}

const PRIMARY = 'flex h-12 w-full items-center justify-center rounded-[14px] bg-accent text-[15px] font-semibold text-on-accent no-underline disabled:opacity-60';
const SECONDARY = 'flex h-12 w-full items-center justify-center rounded-[14px] border border-line text-[15px] font-semibold text-ink';

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Online payment (Phase 9c): tip chips → amount → QR + "open the banking app" → polling until the bank confirms.
 * The attempt is created when the sheet opens (and again when the tip changes or the guest retries).
 */
export function PaymentSheet({ slug, order, locale, t, onClose, onPaid }: Props) {
  const titleId = useId();
  const presets = order.payments.tipPresets.length > 0 ? order.payments.tipPresets : [0];
  const [tipPercent, setTipPercent] = useState<number>(presets[0] ?? 0);
  const [attempt, setAttempt] = useState<PublicPaymentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = order.currency;

  const create = useMutation({
    mutationFn: (percent: number) => createPayment(slug, order.id, percent),
    onSuccess: (payment) => {
      setAttempt(payment);
      setError(null);
    },
    onError: (err) => setError(orderingErrorMessage(err, t)),
  });

  const { mutate: start } = create;
  useEffect(() => {
    start(tipPercent);
  }, [start, tipPercent]);

  const ref = attempt?.ref ?? null;
  const status = useQuery({
    queryKey: ['payment', order.id, ref],
    queryFn: ({ signal }) => fetchPayment(slug, order.id, ref!, signal),
    enabled: ref !== null && attempt?.status === 'pending',
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'pending' ? false : PAYMENT_LIMITS.pollMs),
    refetchIntervalInBackground: true,
  });
  const current = status.data && status.data.ref === ref ? status.data : attempt;

  // Countdown; past the expiry the sheet shows the expired state even before the API says so.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!current || current.status !== 'pending') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [current]);
  const left = current ? secondsLeft(current.expiresAt) : 0;
  const expiredLocally = current?.status === 'pending' && left === 0 && now > 0;
  const state: 'loading' | 'pending' | 'paid' | 'failed' | 'expired' = !current
    ? 'loading'
    : current.status === 'paid'
      ? 'paid'
      : current.status === 'failed'
        ? 'failed'
        : current.status === 'expired' || expiredLocally
          ? 'expired'
          : 'pending';

  useEffect(() => {
    if (state === 'paid') onPaid();
  }, [state, onPaid]);

  const tipCents = tipCentsFor(order.totalCents, tipPercent);
  const amountCents = current?.amountCents ?? order.totalCents + tipCents;

  return (
    <BottomSheet labelledBy={titleId} onClose={onClose} maxHeight="max-h-[94%]">
      <div className="flex flex-col gap-5 px-5 pt-1 pb-8">
        <h2 id={titleId} className="font-serif text-[22px] leading-[1.2] font-bold">
          {state === 'paid' ? t.pay.success : t.pay.sheetTitle}
        </h2>

        {state === 'paid' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
              <CheckIcon width={26} height={26} strokeWidth={2.4} />
            </span>
            <p className="text-2xl font-bold tabular-nums">{formatPrice(amountCents, currency, locale)}</p>
            <p className="max-w-[300px] text-[14px] leading-[1.5] text-muted text-pretty">{t.pay.successBody}</p>
            <button type="button" onClick={onClose} className={`${PRIMARY} mt-2`}>
              {t.pay.done}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[13px] font-semibold text-muted">{t.pay.tip}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.pay.tip}>
                {presets.map((percent) => {
                  const selected = percent === tipPercent;
                  return (
                    <button
                      key={percent}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setTipPercent(percent)}
                      className={`h-10 rounded-full px-4 text-sm font-semibold tabular-nums ${
                        selected ? 'bg-accent text-on-accent' : 'bg-chip text-ink'
                      }`}
                    >
                      {percent === 0 ? t.pay.noTip : `${percent}%`}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-baseline justify-between rounded-[14px] bg-chip px-4 py-3">
              <span className="text-[13px] font-semibold text-muted">{t.pay.toPay}</span>
              <span className="text-xl font-bold tabular-nums">{formatPrice(amountCents, currency, locale)}</span>
            </div>
            {tipCents > 0 && <p className="-mt-3 text-[12.5px] text-muted">{t.pay.paidWithTip(formatPrice(tipCents, currency, locale))}</p>}

            {error ? (
              <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-[1.45] text-bad text-pretty">
                {error}
              </p>
            ) : state === 'loading' ? (
              <p className="py-10 text-center text-sm text-muted" role="status" aria-busy="true">
                {t.pay.preparing}
              </p>
            ) : state === 'pending' && current ? (
              <div className="flex flex-col items-center gap-4">
                <QrCode value={current.qrPayload} label={t.pay.sheetTitle} className="size-[220px] rounded-[18px] border border-line p-3" />
                <p className="max-w-[300px] text-center text-[13.5px] leading-[1.5] text-muted text-pretty">{t.pay.scanHint}</p>
                {current.deepLink && (
                  <a href={current.deepLink} target="_blank" rel="noreferrer" className={PRIMARY}>
                    {t.pay.openBankApp}
                  </a>
                )}
                <p className="flex items-center gap-2 text-xs text-muted tabular-nums" aria-live="polite">
                  <span className="pulse-dot size-1.5 rounded-full bg-muted" aria-hidden="true" />
                  {t.pay.waiting} · {t.pay.expiresIn} {countdown(left)}
                </p>
              </div>
            ) : state === 'failed' || state === 'expired' ? (
              <div className="flex flex-col gap-3" role="alert">
                <div className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-[1.45] text-bad text-pretty">
                  <span className="font-semibold">{state === 'failed' ? t.pay.failed : t.pay.expired}.</span>{' '}
                  {state === 'failed' ? t.pay.failedBody : t.pay.expiredBody}
                </div>
                <button type="button" onClick={() => start(tipPercent)} className={PRIMARY} disabled={create.isPending}>
                  {t.pay.tryAgain}
                </button>
              </div>
            ) : null}

            <button type="button" onClick={onClose} className={SECONDARY}>
              {t.close}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
