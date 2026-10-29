import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Dirty-state guard: with unsaved changes, leaving the page (in-app navigation or closing the tab) asks first.
 * In-app navigation uses the data router's blocker; the tab close uses `beforeunload`.
 */
export function useDirtyGuard(dirty: boolean, message = 'You have unsaved changes. Leave without saving?'): void {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/** ⌘S / Ctrl+S runs `save` instead of the browser's "Save page". */
export function useSaveShortcut(save: () => unknown, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save, enabled]);
}
