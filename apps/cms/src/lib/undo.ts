import { useCallback } from 'react';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from './api';

const UNDO_MS = 6000;

interface PendingDelete {
  timer: number;
  commit: () => void;
}

/** Deletes waiting for their undo window; flushed when the tab is hidden so a closed tab never loses the action. */
const pending = new Map<number, PendingDelete>();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const [id, item] of pending) {
      window.clearTimeout(item.timer);
      item.commit();
      pending.delete(id);
    }
  });
}

export function flushPendingDeletes(): void {
  for (const [id, item] of pending) {
    window.clearTimeout(item.timer);
    item.commit();
    pending.delete(id);
  }
}

interface UndoableDelete {
  /** Toast text, e.g. "Espresso deleted". */
  message: string;
  /** Remove it from the screen now (optimistic). */
  apply: () => void;
  /** Put it back (undo). */
  rollback: () => void;
  /** The real request, sent after the undo window closes. */
  commit: () => Promise<unknown>;
}

/**
 * "Deleted X · Undo": the row disappears at once, the request goes out six seconds later unless Undo was pressed.
 * Keeps the API's hard delete while giving the person the standard grace period.
 */
export function useUndoableDelete(): (options: UndoableDelete) => void {
  const toast = useToast();
  return useCallback(
    ({ message, apply, rollback, commit }: UndoableDelete) => {
      apply();
      let id = 0;
      const run = () => {
        pending.delete(id);
        void commit().catch((error: unknown) => {
          rollback();
          toast.error(errorMessage(error, 'Could not delete'));
        });
      };
      const timer = window.setTimeout(run, UNDO_MS);
      id = toast.success(message, {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            window.clearTimeout(timer);
            pending.delete(id);
            rollback();
          },
        },
      });
      pending.set(id, { timer, commit: run });
    },
    [toast],
  );
}
