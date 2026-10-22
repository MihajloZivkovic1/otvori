import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteError } from '../src/components/shell/RouteError';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../src/lib/stale-chunk';

describe('route error screen', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('reloads once for a chunk replaced by a newer deploy, never in a loop', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: /assets/OrdersPage-1.js'))).toBe(true);
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders a readable screen with a Reload button for other errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter(
      [
        {
          path: '/',
          ErrorBoundary: RouteError,
          loader: () => {
            throw new Error('boom');
          },
          element: <div>never</div>,
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
