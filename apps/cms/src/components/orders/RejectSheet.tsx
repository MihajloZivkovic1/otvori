import { useState } from 'react';
import type { OrderDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { composeReason, rejectReasons } from './reasons';

interface RejectSheetProps {
  order: OrderDto;
  defaultLocale: string;
  isMobile: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** Design B2: reason chips (in the venue's menu language, since the guest reads them) + an optional message. */
export function RejectSheet({ order, defaultLocale, isMobile, loading, onClose, onConfirm }: RejectSheetProps) {
  const reasons = rejectReasons(defaultLocale);
  const [picked, setPicked] = useState(reasons[0]!);
  const [message, setMessage] = useState('');
  const reason = composeReason(picked, message);
  const title = `Reject #${order.number} · Table ${order.tableNumber}`;

  const body = (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">The guest sees the reason on their phone right away. Nothing is charged.</p>
      <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-2">
        {reasons.map((candidate) => {
          const selected = candidate.key === picked.key;
          return (
            <button
              key={candidate.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPicked(candidate)}
              className={cn(
                'h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium transition-colors',
                selected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:bg-line-2',
              )}
            >
              {candidate.label}
            </button>
          );
        })}
      </div>
      <Field
        label={
          <>
            Message to the guest <span className="font-normal text-muted">({picked.needsMessage ? 'required' : 'optional'})</span>
          </>
        }
        htmlFor="reject-message"
      >
        <Textarea
          id="reject-message"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 200))}
          maxLength={200}
          controlSize={isMobile ? 'lg' : 'md'}
          placeholder="e.g. We have granola or kajmak & proja instead."
        />
      </Field>
    </div>
  );

  const footer = (
    <>
      <Button size={isMobile ? 'mobile' : 'md'} className={isMobile ? 'flex-1' : ''} onClick={onClose} disabled={loading}>
        Back
      </Button>
      <Button
        variant="danger-solid"
        size={isMobile ? 'mobile' : 'md'}
        className={isMobile ? 'flex-[2]' : ''}
        onClick={() => onConfirm(reason)}
        disabled={reason.length === 0}
        loading={loading}
      >
        Reject order
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open onClose={onClose} title={title} variant="bottom" footer={<div className="flex gap-2 px-4 pt-4">{footer}</div>}>
        {body}
      </Sheet>
    );
  }
  return (
    <Modal open onClose={onClose} title={title} footer={footer}>
      {body}
    </Modal>
  );
}
