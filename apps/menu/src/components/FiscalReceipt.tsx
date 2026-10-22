import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { PublicOrderDto } from '@qr-menu/shared';
import { orderingErrorMessage, sendReceiptEmail } from '../lib/api';
import type { Dictionary } from '../lib/i18n';
import { QrCode } from './QrCode';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Fiscal receipt of an order paid online (Phase 9d): invoice number, the tax authority's verification QR, the link,
 * and "send to e-mail" when the venue allows it. While the register is still issuing it, a one-line status.
 */
export function FiscalReceipt({ slug, order, t }: { slug: string | null; order: PublicOrderDto; t: Dictionary }) {
  const titleId = useId();
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const send = useMutation({ mutationFn: () => sendReceiptEmail(slug, order.id, email.trim()), onSuccess: () => setSent(true) });

  if (order.fiscalStatus === 'pending') {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
        <span className="pulse-dot size-1.5 rounded-full bg-muted" aria-hidden="true" />
        {t.pay.receiptPending}
      </p>
    );
  }
  if (order.fiscalStatus !== 'issued' || !order.fiscalInvoiceNumber || !order.fiscalVerificationUrl) return null;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={titleId} className="font-serif text-lg leading-[1.25] font-bold">
            {t.pay.receiptTitle}
          </h2>
          <p className="text-[13px] text-muted">
            {t.pay.receiptNumber}: <span className="text-ink tabular-nums">{order.fiscalInvoiceNumber}</span>
          </p>
        </div>
        <QrCode value={order.fiscalVerificationUrl} label={t.pay.receiptTitle} className="size-[84px] flex-none rounded-lg border border-line p-1" />
      </div>
      <a
        href={order.fiscalVerificationUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-11 items-center justify-center rounded-[14px] border border-line text-[14px] font-semibold text-ink no-underline"
      >
        {t.pay.openReceipt}
      </a>
      {order.payments.receiptEmailEnabled &&
        (sent ? (
          <p className="text-[13px] text-ok" role="status">
            {t.pay.emailSent}
          </p>
        ) : (
          <form
            className="flex flex-col gap-1.5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!EMAIL_RE.test(email.trim())) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              send.mutate();
            }}
          >
            <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
              {t.pay.emailReceipt}
            </label>
            <div className="flex gap-2">
              <input
                id={inputId}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.pay.emailPlaceholder}
                aria-invalid={invalid}
                className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={send.isPending}
                className="h-11 shrink-0 rounded-[12px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-60"
              >
                {t.pay.emailSend}
              </button>
            </div>
            {invalid && (
              <p role="alert" className="text-[12.5px] text-bad">
                {t.pay.emailInvalid}
              </p>
            )}
            {send.isError && (
              <p role="alert" className="text-[12.5px] text-bad">
                {orderingErrorMessage(send.error, t)}
              </p>
            )}
          </form>
        ))}
    </section>
  );
}
