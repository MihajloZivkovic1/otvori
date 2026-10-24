import { useState, type FormEvent } from 'react';
import { PIN_LIMITS, weakPinReason } from '@qr-menu/shared';
import { ApiError, errorMessage } from '../../lib/api';
import { useRemovePin, useSetPin } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

interface PinSetupModalProps {
  mode: 'set' | 'change' | 'remove';
  onClose: () => void;
}

/** Settings → Protection: set / change / remove the owner PIN; the account password confirms every change. */
export function PinSetupModal({ mode, onClose }: PinSetupModalProps) {
  const { restaurant } = useRestaurantContext();
  const toast = useToast();
  const setPin = useSetPin(restaurant.id);
  const removePin = useRemovePin(restaurant.id);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = setPin.isPending || removePin.isPending;
  const title = mode === 'set' ? 'Set an owner PIN' : mode === 'change' ? 'Change the owner PIN' : 'Remove the owner PIN';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (mode === 'remove') {
        await removePin.mutateAsync({ password });
        toast.success('Owner PIN removed');
      } else {
        const weak = weakPinReason(pin);
        if (weak) {
          setError(weak);
          return;
        }
        if (pin !== confirm) {
          setError('The two PINs do not match');
          return;
        }
        await setPin.mutateAsync({ pin, password });
        toast.success(mode === 'set' ? 'Owner PIN set — this device stays unlocked until you lock it' : 'Owner PIN changed');
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError('Wrong password');
      else setError(errorMessage(err));
    }
  };

  const digits = (value: string) => value.replace(/\D/g, '').slice(0, PIN_LIMITS.length);

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pin-form" variant={mode === 'remove' ? 'danger-solid' : 'primary'} loading={busy} disabled={!password || (mode !== 'remove' && (pin.length < PIN_LIMITS.length || confirm.length < PIN_LIMITS.length))}>
            {mode === 'set' ? 'Set PIN' : mode === 'change' ? 'Change PIN' : 'Remove PIN'}
          </Button>
        </>
      }
    >
      <form id="pin-form" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        <p className="text-[13px] text-muted text-pretty">
          {mode === 'remove'
            ? 'Without a PIN every signed-in owner session can change prices and settings straight away.'
            : 'Four digits. Staff on the shared device will need it for prices, menu content, branding, settings and the team — never for orders or "unavailable today".'}
        </p>
        {mode !== 'remove' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN" htmlFor="pin-new">
              <Input id="pin-new" inputMode="numeric" autoComplete="off" pattern="\d*" maxLength={PIN_LIMITS.length} value={pin} onChange={(e) => setPinValue(digits(e.target.value))} className="text-center text-lg tracking-[.4em]" data-autofocus />
            </Field>
            <Field label="Repeat PIN" htmlFor="pin-confirm">
              <Input id="pin-confirm" inputMode="numeric" autoComplete="off" pattern="\d*" maxLength={PIN_LIMITS.length} value={confirm} onChange={(e) => setConfirm(digits(e.target.value))} className="text-center text-lg tracking-[.4em]" />
            </Field>
          </div>
        ) : null}
        <Field label="Your password" htmlFor="pin-password" hint="Confirms it is you, not someone at the bar." error={error ?? undefined}>
          <Input id="pin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(error)} data-autofocus={mode === 'remove' ? true : undefined} />
        </Field>
      </form>
    </Modal>
  );
}
