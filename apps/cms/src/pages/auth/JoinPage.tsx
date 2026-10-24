import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { TEAM_LIMITS, joinWithCodeSchema, type AuthResponseDto } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout, FormError } from './AuthLayout';

/** /join — "Konobarski nalog": the 6-digit code from the owner + a name and password = a staff account. */
export function JoinPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<AuthResponseDto | null>(null);

  if (status === 'authenticated' && !done) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = joinWithCodeSchema.safeParse({ code, name, password, ...(email.trim() ? { email } : {}) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api<AuthResponseDto>('/api/auth/join', { method: 'POST', auth: false, body: parsed.data });
      setDone(session);
      signIn(session, true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'JOIN_CODE_INVALID') setError('That code is wrong or has expired — ask the owner for a new one.');
      else setError(errorMessage(err, 'Could not create the account'));
    } finally {
      setBusy(false);
    }
  };

  const size = isMobile ? 'mobile' : 'lg';
  const controlSize = isMobile ? 'lg' : 'md';

  if (done) {
    const venue = done.memberships[0]?.restaurant;
    return (
      <AuthLayout
        title={`Welcome to ${venue?.name ?? 'the team'}`}
        subtitle={
          <>
            Your account is ready. Sign in with <strong className="text-ink">{done.user.email}</strong> and your password — write the address down if it was generated for you.
          </>
        }
      >
        <Button variant="primary" size={size} block onClick={() => navigate(venue ? `/r/${venue.id}` : '/', { replace: true })}>
          Open {venue?.name ?? 'otvori'}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join with a code"
      subtitle="Ask the owner for the 6-digit join code from Settings → Team. You get a staff account for orders, calls and “unavailable today”."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium no-underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4 max-tab:gap-3">
        <FormError message={error} />
        <Field label="Join code" htmlFor="join-code">
          <Input
            id="join-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={TEAM_LIMITS.joinCodeLength}
            placeholder="482913"
            controlSize={controlSize}
            className="text-center text-xl tracking-[.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, TEAM_LIMITS.joinCodeLength))}
            data-autofocus
          />
        </Field>
        <Field label="Your name" htmlFor="join-name">
          <Input id="join-name" autoComplete="name" controlSize={controlSize} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail (optional)" htmlFor="join-email" hint="Without it we create a sign-in name for you, e.g. marko@kafeterija.staff.otvori.menu.">
          <Input id="join-email" type="email" inputMode="email" autoComplete="email" controlSize={controlSize} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="join-password" hint="At least 8 characters.">
          <Input id="join-password" type="password" autoComplete="new-password" controlSize={controlSize} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size={size} loading={busy} block>
          Create staff account
        </Button>
      </form>
    </AuthLayout>
  );
}
