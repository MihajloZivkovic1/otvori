import { cn } from '../../lib/cn';
import { StatusPill } from '../ui/Chip';

/** "Live" while the SSE stream is open; while reconnecting the lists poll every 10 s. */
export function LivePill({ connected, className }: { connected: boolean; className?: string }) {
  return (
    <StatusPill tone={connected ? 'success' : 'warning'} className={cn('rounded-full font-medium', className)}>
      <span className="sr-only">{connected ? 'Connected: ' : 'Reconnecting: '}</span>
      {connected ? 'Live' : 'Reconnecting…'}
    </StatusPill>
  );
}
