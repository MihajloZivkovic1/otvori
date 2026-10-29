import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router';
import { emailSchema, loginSchema, type AuthResponseDto, type LoginInput } from '@qr-menu/shared';
import { Icon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { AuthLayout, FormError } from './AuthLayout';

function loginError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  }
  return errorMessage(error, 'Could not sign in');
}

export function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);
  const [sendingMagic, setSendingMagic] = useState(false);
  const navState = location.state as { from?: string; reason?: string } | null;
  const from = navState?.from;
  const [expiredNotice, setExpiredNotice] = useState(navState?.reason === 'expired');

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'authenticated') return <Navigate to={from && from !== '/login' ? from : '/'} replace />;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    setExpiredNotice(false);
    try {
      const session = await api<AuthResponseDto>('/api/auth/login', { method: 'POST', body: values, auth: false });
      signIn(session, remember);
    } catch (err) {
      setError(loginError(err));
    }
  });

  const sendMagicLink = async () => {
    setError(null);
    const parsed = emailSchema.safeParse(form.getValues('email'));
    if (!parsed.success) {
      form.setError('email', { message: 'Enter your email to receive a link' });
      form.setFocus('email');
      return;
    }
    setSendingMagic(true);
    try {
      await api('/api/auth/magic-link', { method: 'POST', body: { email: parsed.data }, auth: false });
      setMagicSentTo(parsed.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the link'));
    } finally {
      setSendingMagic(false);
    }
  };

  const controlSize = isMobile ? 'lg' : 'md';

  if (magicSentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={<>If an account exists for <strong className="text-ink">{magicSentTo}</strong>, we sent a sign-in link. It expires in 15 minutes.</>}>
        <Button size={isMobile ? 'mobile' : 'lg'} onClick={() => setMagicSentTo(null)}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle={isMobile ? undefined : 'Manage your menu, tables and branding.'}
      footer={
        <>
          New to otvori?{' '}
          <Link to="/register" className="font-medium no-underline">
            Create a restaurant
          </Link>
          <br />
          Waiter with a join code?{' '}
          <Link to="/join" className="font-medium no-underline">
            Join with a code
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 max-tab:gap-3">
        <FormError message={error} />
        {expiredNotice && !error ? (
          <p role="status" className="rounded-lg bg-line-2 px-3 py-2 text-[13px] text-ink-2">
            Your session expired. Sign in again to continue where you left off.
          </p>
        ) : null}
        <Field label={isMobile ? <span className="sr-only">Email</span> : 'Email'} htmlFor="login-email" error={form.formState.errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={isMobile ? 'Email' : 'you@restaurant.rs'}
            controlSize={controlSize}
            invalid={Boolean(form.formState.errors.email)}
            data-autofocus
            {...form.register('email')}
          />
        </Field>
        <Field
          label={isMobile ? <span className="sr-only">Password</span> : 'Password'}
          htmlFor="login-password"
          error={form.formState.errors.password?.message}
          trailing={
            isMobile ? null : (
              <Link to="/forgot" className="text-[13px] font-medium no-underline">
                Forgot?
              </Link>
            )
          }
        >
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={isMobile ? 'Password' : '••••••••'}
            controlSize={controlSize}
            invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>
        <div className="flex min-h-11 items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] max-tab:text-[15px] tab:text-[13px]">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span
              aria-hidden="true"
              className={cn(
                'grid size-[22px] place-items-center rounded-md border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent tab:size-[18px] tab:rounded',
                remember ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface',
              )}
            >
              {remember ? <Icon name="check" size={12} strokeWidth={2.2} /> : null}
            </span>
            Remember me
          </label>
          {isMobile ? (
            <Link to="/forgot" className="text-sm font-medium no-underline">
              Forgot?
            </Link>
          ) : null}
        </div>
        <Button type="submit" variant="primary" size={isMobile ? 'mobile' : 'lg'} loading={form.formState.isSubmitting} block>
          Continue
        </Button>
        {isMobile ? null : (
          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            or
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>
        )}
        <Button size={isMobile ? 'mobile' : 'lg'} loading={sendingMagic} onClick={() => void sendMagicLink()} block>
          Email me a magic link
        </Button>
      </form>
    </AuthLayout>
  );
}
