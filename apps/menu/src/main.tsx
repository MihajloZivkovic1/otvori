import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ApiError } from './lib/api';
import { pathSlugFromLocation, readCachedTenant, resolveTenant, tenantKeyFor } from './lib/tenant';
import { applyTheme } from './lib/theme';
import './styles.css';

// Re-apply the last known theme + accent for this tenant before the first paint, so returning guests
// never see a light flash on a dark menu.
const cachedTenant = readCachedTenant(tenantKeyFor(resolveTenant(pathSlugFromLocation(window.location.pathname)).slug));
if (cachedTenant) applyTheme(cachedTenant.theme, cachedTenant.primaryColor);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers (not published, not found) are final; everything else gets two quick retries.
      retry: (failureCount, error) => failureCount < 2 && !(error instanceof ApiError && error.status < 500),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
