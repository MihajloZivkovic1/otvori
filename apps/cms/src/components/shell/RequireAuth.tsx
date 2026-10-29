import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { lastPath } from '../../lib/storage';
import { ChangePasswordPage } from '../../pages/auth/ChangePasswordPage';
import { Spinner } from '../ui/Button';

export function FullPageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid min-h-dvh place-items-center bg-canvas text-muted">
      <Spinner className="size-5 border-line-strong border-r-accent" />
    </div>
  );
}

/**
 * Layout route: restores the session from the refresh cookie, otherwise sends the user to /login. Remembers the
 * last page per user (so "/" returns there) and holds the app until an admin-set password was replaced.
 */
export function RequireAuth() {
  const { status, me, signedOutExplicitly, expired } = useAuth();
  const location = useLocation();
  const userId = me?.user.id ?? null;
  const path = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (userId && location.pathname !== '/') lastPath.set(userId, path);
  }, [userId, path, location.pathname]);

  if (status === 'restoring') return <FullPageLoading />;
  if (status === 'anonymous') {
    // After an expired session the user returns to where they were; after "Sign out" the next account starts fresh.
    const state = signedOutExplicitly ? undefined : { from: path, reason: expired ? 'expired' : undefined };
    return <Navigate to="/login" replace state={state} />;
  }
  if (me?.user.mustChangePassword) return <ChangePasswordPage />;
  return <Outlet />;
}
