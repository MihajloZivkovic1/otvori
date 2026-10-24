import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { AuthResponseDto, InvitePreviewDto } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout, FormError } from './AuthLayout';

/** /auth/invite?token= — the link from "Invite by e-mail": shows the venue and role, then joins (and signs in). */
export function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { signIn } = useAuth();
  const [preview, setPreview] = useState<InvitePreviewDto | null>(null);
  const [error, setError] = useState<string | null>(() => (token ? null : 'This invite link is incomplete.'));
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<InvitePreviewDto>(`/api/auth/invite/${encodeURIComponent(token)}`, { auth: false })
      .then(setPreview)
      .catch((err: unknown) => setError(errorMessage(err, 'This invite link is invalid or has expired.')));
  }, [token]);

  const accept = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<AuthResponseDto>('/api/auth/invite', {
        method: 'POST',
        auth: false,
        body: { token, ...(preview?.existingUser ? {} : { name: name.trim(), ...(password ? { password } : {}) }) },
      });
      signIn(session, true);
      navigate(`/r/${session.memberships.find((m) => m.restaurant.name === preview?.restaurantName)?.restaurant.id ?? ''}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not accept the invite'));
    } finally {
      setBusy(false);
    }
  };

  const size = isMobile ? 'mobile' : 'lg';
  if (!preview) {
    return (
      <AuthLayout title={error ? 'Invite not valid' : 'Opening your invite…'} subtitle={error ?? 'One moment.'}>
        {error ? (
          <Link to="/login" className="font-medium no-underline">
            Go to sign in
          </Link>
        ) : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${preview.restaurantName}`}
      subtitle={
        <>
          You were invited as <strong className="text-ink">{preview.role}</strong> ({preview.email}).{' '}
          {preview.role === 'staff' ? 'Staff see orders, calls and “unavailable today” — never prices or settings.' : null}
        </>
      }
    >
      <form onSubmit={(event) => void accept(event)} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        {preview.existingUser ? null : (
          <>
            <Field label="Your name" htmlFor="invite-name">
              <Input id="invite-name" autoComplete="name" controlSize={isMobile ? 'lg' : 'md'} value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
            </Field>
            <Field label="Password" htmlFor="invite-password" hint="Optional — you can always sign in with an e-mailed link instead.">
              <Input id="invite-password" type="password" autoComplete="new-password" controlSize={isMobile ? 'lg' : 'md'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        )}
        <Button type="submit" variant="primary" size={size} loading={busy} disabled={!preview.existingUser && !name.trim()} block>
          {preview.existingUser ? 'Join venue' : 'Create account & join'}
        </Button>
      </form>
    </AuthLayout>
  );
}
