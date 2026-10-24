import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_ELEVATION_WINDOW, ELEVATION_WINDOWS, PIN_LIMITS, type ElevationDto, type ElevationWindow, type RestaurantDto } from '@qr-menu/shared';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { ApiError, errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { clock } from '../../lib/format';
import { unlockVenue } from '../../lib/queries';
import { unlockWindow } from '../../lib/storage';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';

const WINDOW_LABELS: Record<ElevationWindow, string> = { '1': '1 min', '5': '5 min', '15': '15 min', session: 'Until sign-out' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function rememberedWindow(): ElevationWindow {
  const stored = unlockWindow.get();
  return (ELEVATION_WINDOWS as readonly string[]).includes(stored ?? '') ? (stored as ElevationWindow) : DEFAULT_ELEVATION_WINDOW;
}

interface PinKeypadProps {
  restaurant: RestaurantDto;
  onUnlocked: (elevation: ElevationDto) => void;
  onCancel: () => void;
}

/**
 * The owner PIN keypad (Phase 11): four dots, big one-handed keys (56 px, ≥ 44 px tap target), the unlock window,
 * and "use password instead" for the owner's own device. Submits itself on the fourth digit.
 */
export function PinKeypad({ restaurant, onUnlocked, onCancel }: PinKeypadProps) {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pin, setPin] = useState('');
  const [window, setWindow] = useState<ElevationWindow>(rememberedWindow);
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  useFocusTrap(ref, true, onCancel);
  useLockBodyScroll(true);

  // The keypad is short-lived: once the API said "locked until …", the keys stay disabled until it is reopened.
  const locked = lockedUntil !== null;

  const submit = async (input: { pin?: string; password?: string }) => {
    setBusy(true);
    setError(null);
    try {
      unlockWindow.set(window);
      const elevation = await unlockVenue(restaurant.id, { ...input, window });
      onUnlocked(elevation);
    } catch (err) {
      setPin('');
      if (err instanceof ApiError && err.code === 'PIN_LOCKED') {
        const until = (err.details as { lockedUntil?: string } | undefined)?.lockedUntil ?? null;
        setLockedUntil(until);
        setError(`Too many wrong PINs. Try again at ${until ? clock(until) : 'a later time'}.`);
      } else if (err instanceof ApiError && err.code === 'PIN_INVALID') {
        const left = (err.details as { attemptsLeft?: number } | undefined)?.attemptsLeft;
        setError(left !== undefined ? `Wrong PIN — ${left} ${left === 1 ? 'attempt' : 'attempts'} left` : 'Wrong PIN');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Wrong password');
      } else {
        setError(errorMessage(err, 'Could not unlock'));
      }
    } finally {
      setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (busy || locked) return;
    setError(null);
    const next = (pin + digit).slice(0, PIN_LIMITS.length);
    setPin(next);
    if (next.length === PIN_LIMITS.length) void submit({ pin: next });
  };
  const backspace = () => setPin((p) => p.slice(0, -1));

  // Physical keyboard on a laptop: digits, Backspace.
  useEffect(() => {
    if (mode !== 'pin') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') backspace();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (password) void submit({ password });
  };

  const body = (
    <div className="flex flex-col items-center gap-4 px-5 pb-4 pt-2">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="lock" size={20} strokeWidth={1.8} />
        </span>
        <h2 id={titleId} className="text-[17px] font-semibold">
          Owner PIN
        </h2>
        <p className="text-[13px] text-muted text-pretty">
          {mode === 'pin' ? `Unlock owner actions for ${restaurant.name} on this device.` : 'Enter your account password to unlock this device.'}
        </p>
      </div>

      {mode === 'pin' ? (
        <>
          <div className="flex gap-3" aria-label={`${pin.length} of ${PIN_LIMITS.length} digits entered`} role="status">
            {Array.from({ length: PIN_LIMITS.length }, (_, i) => (
              <span key={i} aria-hidden="true" className={cn('size-3.5 rounded-full border-2 border-accent transition-colors', i < pin.length ? 'bg-accent' : 'bg-transparent')} />
            ))}
          </div>
          <div className="min-h-5 text-center text-[13px] font-medium text-danger-text">
            {error ? <span role="alert">{error}</span> : null}
          </div>
          <div className="grid w-full max-w-[300px] grid-cols-3 gap-2" aria-label="Keypad">
            {KEYS.map((digit) => (
              <Key key={digit} label={digit} onPress={() => press(digit)} disabled={busy || locked} />
            ))}
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
              }}
              className="h-14 cursor-pointer rounded-xl text-[13px] font-medium text-accent"
            >
              Password
            </button>
            <Key label="0" onPress={() => press('0')} disabled={busy || locked} />
            <button type="button" aria-label="Delete last digit" onClick={backspace} disabled={pin.length === 0 || busy} className="grid h-14 cursor-pointer place-items-center rounded-xl text-ink-2 disabled:opacity-40">
              <Icon name="back" size={20} strokeWidth={2} />
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submitPassword} className="flex w-full max-w-[300px] flex-col gap-3">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            controlSize="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(error)}
            data-autofocus
          />
          {error ? (
            <span role="alert" className="text-[13px] font-medium text-danger-text">
              {error}
            </span>
          ) : null}
          <Button type="submit" variant="primary" size="xl" loading={busy} disabled={!password}>
            Unlock with password
          </Button>
          <button type="button" className="cursor-pointer text-[13px] font-medium text-accent" onClick={() => setMode('pin')}>
            Use the PIN instead
          </button>
        </form>
      )}

      <div role="radiogroup" aria-label="Stay unlocked for" className="flex w-full max-w-[300px] flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">Stay unlocked for</span>
        <div className="grid grid-cols-4 gap-1.5">
          {ELEVATION_WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={window === option}
              onClick={() => setWindow(option)}
              className={cn(
                'h-9 cursor-pointer rounded-lg border px-1 text-[12px] font-medium',
                window === option ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink-2',
              )}
            >
              {WINDOW_LABELS[option]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-faint">Pick a short window on the shared bar device; "until sign-out" on your own.</span>
      </div>
      <Button variant="ghost" size="lg" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-[70] flex flex-col justify-end">
        <div className="fade-enter absolute inset-0 bg-[rgba(24,24,27,.4)]" onClick={onCancel} aria-hidden="true" />
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="sheet-enter relative flex max-h-[92dvh] flex-col overflow-auto rounded-t-[20px] bg-surface pb-[calc(8px+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong" aria-hidden="true" />
          {body}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fade-enter fixed inset-0 z-[70] grid place-items-center bg-[rgba(24,24,27,.4)] p-4" onClick={onCancel}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()} className="pop-enter w-full max-w-[380px] overflow-auto rounded-xl bg-surface pt-3 text-ink shadow-[0_24px_60px_rgba(0,0,0,.25)]">
        {body}
      </div>
    </div>,
    document.body,
  );
}

function Key({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="h-14 cursor-pointer rounded-xl border border-line bg-surface text-2xl font-medium text-ink transition-colors hover:bg-line-2 active:bg-line disabled:cursor-default disabled:opacity-40"
    >
      {label}
    </button>
  );
}
