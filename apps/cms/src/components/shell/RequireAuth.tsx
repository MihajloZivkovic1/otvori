import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { Spinner } from '../ui/Button';

export function FullPageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid min-h-dvh place-items-center bg-canvas text-muted">
      <Spinner className="size-5 border-line-strong border-r-accent" />
    </div>
  );
}

/** Layout route: restores the session from the refresh cookie, otherwise sends the user to /login. */
export function RequireAuth() {
  const { status, signedOutExplicitly } = useAuth();
  const location = useLocation();
  if (status === 'restoring') return <FullPageLoading />;
  if (status === 'anonymous') {
    // After an expired session the user returns to where they were; after "Sign out" the next account starts fresh.
    const state = signedOutExplicitly ? undefined : { from: `${location.pathname}${location.search}` };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}
