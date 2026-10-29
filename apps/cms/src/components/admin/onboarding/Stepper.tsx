import { ONBOARDING_STEPS } from '@qr-menu/shared';
import { cn } from '../../../lib/cn';
import { Icon } from '../../icons';

export const STEP_LABELS: Record<(typeof ONBOARDING_STEPS)[number], string> = { venue: 'Venue', owner: 'Owner', plan: 'Plan & modules', setup: 'Setup' };

/** 1 — 2 — 3 — 4 with the current one filled; past steps are links back when `onGo` is given. */
export function Stepper({ current, onGo }: { current: number; onGo?: (step: number) => void }) {
  return (
    <ol aria-label="Steps" className="flex items-center gap-1 text-[13px]">
      {ONBOARDING_STEPS.map((key, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'todo';
        const dot = (
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
              state === 'done' && 'bg-accent text-on-accent',
              state === 'current' && 'bg-ink text-surface',
              state === 'todo' && 'border border-line text-muted',
            )}
          >
            {state === 'done' ? <Icon name="check" size={11} strokeWidth={2.6} /> : number}
          </span>
        );
        return (
          <li key={key} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 items-center gap-1">
            {state === 'done' && onGo ? (
              <button type="button" onClick={() => onGo(number)} className="flex cursor-pointer items-center gap-1.5 rounded-md py-0.5 pr-1.5 hover:bg-line-2">
                {dot}
                <span className="hidden truncate text-ink-2 tab:inline">{STEP_LABELS[key]}</span>
              </button>
            ) : (
              <span className="flex items-center gap-1.5 py-0.5 pr-1.5">
                {dot}
                <span className={cn('hidden truncate tab:inline', state === 'current' ? 'font-medium text-ink' : 'text-muted')}>{STEP_LABELS[key]}</span>
              </span>
            )}
            {index < ONBOARDING_STEPS.length - 1 ? <span aria-hidden="true" className="h-px w-4 bg-line-strong tab:w-8" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
