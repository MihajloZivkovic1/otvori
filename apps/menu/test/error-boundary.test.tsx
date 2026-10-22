import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../src/lib/stale-chunk';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

describe('error boundary', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('recognises a chunk that vanished after a deploy and reloads exactly once', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: /assets/ItemSheet-abc.js'))).toBe(true);
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('shows a bilingual reload screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom message="render exploded" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });
});
