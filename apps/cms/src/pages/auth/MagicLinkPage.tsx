import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import type { AuthResponseDto } from '@qr-menu/shared';
import { Spinner } from '../../components/ui/Button';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout, FormError } from './AuthLayout';

/** /auth/magic?token=… — consumes the one-time token and signs the user in. */
export function MagicLinkPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { status, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setError('This link is missing its token.');
      return;
    }
    api<AuthResponseDto>(`/api/auth/magic-link/${encodeURIComponent(token)}`, { auth: false })
      .then((session) => signIn(session, true))
      .catch((err: unknown) => setError(errorMessage(err, 'This link is invalid or has expired.')));
  }, [token, signIn]);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <AuthLayout
      title={error ? 'Link not valid' : 'Signing you in…'}
      footer={
        <Link to="/login" className="font-medium no-underline">
          Back to sign in
        </Link>
      }
    >
      {error ? <FormError message={error} /> : <Spinner className="size-5 border-line-strong border-r-accent" />}
    </AuthLayout>
  );
}
