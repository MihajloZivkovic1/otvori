import { useState, type FormEvent } from 'react';
import { emailSchema, passwordSchema } from '@qr-menu/shared';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useChangePassword, useRevokeSessions, useSessions, useUpdateProfile } from '../../lib/account';
import { errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { relativeTime } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

function device(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return [os, browser].filter(Boolean).join(' · ');
}

/** Profile (name, e-mail), password change and the devices list with "sign out everywhere else". */
export function ProfileModal({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();
  const me = useMe();
  const { t } = useT();
  const { refreshMe, signIn } = useAuth();
  const toast = useToast();
  const update = useUpdateProfile();
  const change = useChangePassword();
  const sessions = useSessions();
  const revoke = useRevokeSessions();
  const [name, setName] = useState(me.user.name);
  const [email, setEmail] = useState(me.user.email);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const emailChanged = email.trim().toLowerCase() !== me.user.email;
  const profileDirty = name.trim() !== me.user.name || emailChanged;

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setProfileError('Name is required');
    if (emailChanged && !emailSchema.safeParse(email).success) return setProfileError('Enter a valid e-mail address');
    if (emailChanged && !confirmPassword) return setProfileError('Enter your password to change the e-mail');
    setProfileError(null);
    update.mutate(
      { name: name.trim(), ...(emailChanged ? { email: email.trim(), currentPassword: confirmPassword } : {}) },
      {
        onSuccess: () => {
          void refreshMe();
          setConfirmPassword('');
          toast.success('Profile saved');
        },
        onError: (error) => setProfileError(errorMessage(error)),
      },
    );
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(next);
    if (!parsed.success) return setPasswordError(parsed.error.issues[0]?.message ?? 'Invalid password');
    setPasswordError(null);
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: (session) => {
          signIn(session, true);
          setCurrent('');
          setNext('');
          toast.success('Password changed; other devices were signed out');
        },
        onError: (error) => setPasswordError(errorMessage(error)),
      },
    );
  };

  const body = (
    <div className="flex flex-col gap-6">
      <form onSubmit={saveProfile} noValidate className="flex flex-col gap-3" aria-label={t('Profile')}>
        <h3 className="text-sm font-semibold">{t('Profile')}</h3>
        <Field label={t('Name')} htmlFor="pf-name">
          <Input id="pf-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={100} />
        </Field>
        <Field label={t('E-mail')} htmlFor="pf-email" hint={emailChanged ? 'Changing the e-mail needs your password.' : undefined}>
          <Input id="pf-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </Field>
        {emailChanged ? (
          <Field label={t('Current password')} htmlFor="pf-confirm">
            <Input id="pf-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="current-password" />
          </Field>
        ) : null}
        {profileError ? (
          <p role="alert" className="text-xs text-danger-text">
            {profileError}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" size="sm" disabled={!profileDirty} loading={update.isPending}>
            {t('Save')}
          </Button>
        </div>
      </form>

      <form onSubmit={savePassword} noValidate className="flex flex-col gap-3 border-t border-line-2 pt-5" aria-label={t('Change password')}>
        <h3 className="text-sm font-semibold">{t('Change password')}</h3>
        {me.user.hasPassword ? null : <p className="text-[13px] text-muted">This account signs in with magic links. Use “Forgot password” on the sign-in page to set one.</p>}
        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
          <Field label={t('Current password')} htmlFor="pf-current">
            <Input id="pf-current" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" disabled={!me.user.hasPassword} />
          </Field>
          <Field label={t('New password')} htmlFor="pf-next" hint="At least 8 characters.">
            <Input id="pf-next" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" disabled={!me.user.hasPassword} />
          </Field>
        </div>
        {passwordError ? (
          <p role="alert" className="text-xs text-danger-text">
            {passwordError}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" size="sm" disabled={!current || !next || !me.user.hasPassword} loading={change.isPending}>
            {t('Change password')}
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3 border-t border-line-2 pt-5" aria-label={t('Devices')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t('Devices')}</h3>
          <Button size="sm" variant="danger-ghost" loading={revoke.isPending} disabled={(sessions.data?.length ?? 0) <= 1} onClick={() => revoke.mutate(undefined, { onSuccess: () => toast.success('Other devices signed out'), onError: (error) => toast.error(errorMessage(error)) })}>
            {t('Sign out everywhere else')}
          </Button>
        </div>
        {sessions.isPending ? (
          <div role="status" aria-busy="true" aria-label="Loading devices" className="flex flex-col gap-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : sessions.isError ? (
          <p className="text-[13px] text-muted">{errorMessage(sessions.error)}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2 rounded-[10px] border border-line">
            {(sessions.data ?? []).map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <span className="truncate">{device(session.userAgent)}</span>
                    {session.current ? <Badge className="bg-accent-soft text-accent">{t('This device').toUpperCase()}</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {session.ip ?? '—'} · signed in {relativeTime(session.createdAt).toLowerCase()} · active {relativeTime(session.lastUsedAt).toLowerCase()}
                  </div>
                </div>
                {session.current ? null : (
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(session.id, { onError: (error) => toast.error(errorMessage(error)) })}>
                    {t('Sign out')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open onClose={onClose} title={t('Account')} variant="bottom">
        <div className="pb-4">{body}</div>
      </Sheet>
    );
  }
  return (
    <Modal open onClose={onClose} title={t('Account')} size="md" footer={<Button onClick={onClose}>Close</Button>}>
      {body}
    </Modal>
  );
}
