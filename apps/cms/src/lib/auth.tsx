import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthResponseDto, MeDto } from '@qr-menu/shared';
import { api, refreshSession, setUnauthorizedHandler, tokenStore } from './api';
import { sessionFlags } from './storage';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  me: MeDto | null;
  /** Store a session returned by login/register/magic link/reset. */
  signIn(session: AuthResponseDto, remember?: boolean): void;
  signOut(): Promise<void>;
  /** Re-fetch GET /api/auth/me (after creating/deleting a venue, renaming it, …). */
  refreshMe(): Promise<MeDto | null>;
  /** True after an explicit sign-out, so the login page does not send the next account back to the old venue. */
  signedOutExplicitly: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (sessionFlags.shouldRestore() ? 'restoring' : 'anonymous'));
  const [me, setMe] = useState<MeDto | null>(null);
  const [signedOutExplicitly, setSignedOutExplicitly] = useState(false);
  const restoreStarted = useRef(false);

  // Silent restore via the refresh cookie (only when "remember me" or an open tab session allows it).
  // The ref guard (not an effect cleanup) keeps StrictMode's double invocation from consuming the one-time
  // refresh token twice or orphaning the first attempt.
  useEffect(() => {
    if (status !== 'restoring' || restoreStarted.current) return;
    restoreStarted.current = true;
    void refreshSession().then((session) => {
      if (session) {
        setMe({ user: session.user, memberships: session.memberships });
        setStatus('authenticated');
      } else {
        sessionFlags.clear();
        setStatus('anonymous');
      }
    });
  }, [status]);

  // The API client reports when even the refresh token is gone.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      sessionFlags.clear();
      setMe(null);
      setStatus('anonymous');
      queryClient.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const signIn = useCallback((session: AuthResponseDto, remember = true) => {
    tokenStore.set(session.accessToken);
    sessionFlags.markSignedIn(remember);
    setMe({ user: session.user, memberships: session.memberships });
    setSignedOutExplicitly(false);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', auth: false });
    } catch {
      // the local session is dropped regardless
    }
    tokenStore.set(null);
    sessionFlags.clear();
    setMe(null);
    setSignedOutExplicitly(true);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const refreshMe = useCallback(async () => {
    try {
      const next = await api<MeDto>('/api/auth/me');
      setMe(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, me, signIn, signOut, refreshMe, signedOutExplicitly }),
    [status, me, signIn, signOut, refreshMe, signedOutExplicitly],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in user; only call below <RequireAuth>. */
export function useMe(): MeDto {
  const { me } = useAuth();
  if (!me) throw new Error('useMe called while signed out');
  return me;
}
