import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { useElevation } from './ElevationProvider';

function remaining(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The small lock in the top bar (desktop) / status strip (phone): "Locked" with Unlock, or "Unlocked · 4:32" with
 * Lock to forget the elevation on this device at once. Only rendered for owners of a venue with a PIN.
 */
export function LockStatus({ variant }: { variant: 'topbar' | 'strip' }) {
  const { pinSet, locked, elevation, ensureElevated, lock } = useElevation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!elevation) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [elevation]);
  if (!pinSet) return null;

  const label = locked ? 'Locked' : elevation?.window === 'session' ? 'Unlocked until sign-out' : `Unlocked · ${remaining(elevation!.expiresAt, now)}`;
  const action = locked ? (
    <button type="button" onClick={() => void ensureElevated()} className="cursor-pointer font-semibold text-accent">
      Unlock
    </button>
  ) : (
    <button type="button" onClick={lock} className="cursor-pointer font-semibold text-accent">
      Lock
    </button>
  );

  if (variant === 'strip') {
    return (
      <div role="status" className={cn('flex h-9 shrink-0 items-center justify-between gap-3 border-b border-line px-4 text-[12px]', locked ? 'bg-line-2 text-ink-2' : 'bg-accent-soft text-ink')}>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Icon name="lock" size={13} strokeWidth={2} className={locked ? 'text-muted' : 'text-accent'} />
          {label}
        </span>
        {action}
      </div>
    );
  }
  return (
    <div role="status" className={cn('inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs tabular-nums', locked ? 'border-line bg-line-2 text-ink-2' : 'border-accent/30 bg-accent-soft text-ink')}>
      <Icon name="lock" size={13} strokeWidth={2} className={locked ? 'text-muted' : 'text-accent'} />
      {label}
      {action}
    </div>
  );
}

/** Small lock glyph shown on owner controls while the device is locked (tapping them opens the keypad). */
export function LockGlyph({ className }: { className?: string }) {
  const { locked } = useElevation();
  if (!locked) return null;
  return <Icon name="lock" size={12} strokeWidth={2.2} className={cn('shrink-0 opacity-80', className)} aria-label="Needs the owner PIN" />;
}
