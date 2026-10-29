import { useState, type FormEvent } from 'react';
import { passwordSchema } from '@qr-menu/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useChangePassword } from '../../lib/account';
import { errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { AuthLayout, FormError } from './AuthLayout';

/**
 * Shown instead of the app while `user.mustChangePassword` (an admin typed the current password, Phase 13).
 * The current password is the one they just signed in with.
 */
export function ChangePasswordPage() {
  const isMobile = useIsMobile();
  const me = useMe();
  const { signIn, signOut } = useAuth();
  const { t } = useT();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid password');
    setError(null);
    change.mutate({ currentPassword: current, newPassword: next }, { onSuccess: (session) => signIn(session, true), onError: (err) => setError(errorMessage(err)) });
  };

  const size = isMobile ? 'lg' : 'md';
  return (
    <AuthLayout
      title={t('Set a new password')}
      subtitle={t('Your password was set by an administrator. Choose your own before you continue.')}
      footer={
        <>
          {me.user.email}
          {' · '}
          <button type="button" onClick={() => void signOut()} className="cursor-pointer font-medium text-accent">
            {t('Sign out')}
          </button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label={t('Current password')} htmlFor="cp-current">
          <Input id="cp-current" type="password" autoComplete="current-password" controlSize={size} value={current} onChange={(event) => setCurrent(event.target.value)} data-autofocus />
        </Field>
        <Field label={t('New password')} htmlFor="cp-next" hint="At least 8 characters.">
          <Input id="cp-next" type="password" autoComplete="new-password" controlSize={size} value={next} onChange={(event) => setNext(event.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size={isMobile ? 'mobile' : 'lg'} loading={change.isPending} disabled={!current || !next} block>
          {t('Change password')}
        </Button>
      </form>
    </AuthLayout>
  );
}
