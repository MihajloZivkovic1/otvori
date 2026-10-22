import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../lib/stale-chunk';

interface State {
  error: unknown;
}

/**
 * Last line of defence: without it a render-time error (typically a chunk that vanished after a deploy) unmounts the
 * root and the guest sees a blank page. Copy is bilingual because the locale lives inside the tree that just failed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (isStaleChunkError(error) && reloadOnceForStaleChunk()) return;
    if (import.meta.env.DEV) console.error('[otvori] render error', error, info.componentStack);
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-[640px] flex-col items-center justify-center gap-3.5 px-10 text-center">
        <h1 className="font-serif text-[22px] leading-[1.25] font-bold text-pretty">Nešto je pošlo naopako · Something went wrong</h1>
        <p className="max-w-[300px] text-[15px] leading-[1.5] text-muted text-pretty">
          Osveži stranicu da bi dobio najnoviju verziju menija. · Reload the page to get the latest version of the menu.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-12 rounded-[14px] bg-accent px-6 text-[15px] font-semibold text-on-accent"
        >
          Osveži · Reload
        </button>
      </div>
    );
  }
}
