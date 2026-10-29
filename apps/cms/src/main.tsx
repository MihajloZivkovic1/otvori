import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/ui/Toast';
import { ApiError } from './lib/api';
import { AuthProvider } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { applyTheme, themeStore } from './lib/theme';
import { clearStaleChunkFlag, reloadOnceForStaleChunk } from './lib/stale-chunk';
import { createAppRouter } from './router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers are final; network/5xx get one quick retry.
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

// A tab left open across a deploy (the waiter's phone) would otherwise fail on the first lazy chunk of the old build.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault();
});
clearStaleChunkFlag();
// Appearance and language are per browser; apply before the first paint.
applyTheme(themeStore.get());

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// App-shell service worker (production only; never caches /api).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
