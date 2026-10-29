import { useEffect, useState, type FormEvent } from 'react';
import { emailSchema, phoneSchema, type MembershipRole, type SuperadminAddMemberInput } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Switch } from '../ui/Switch';
import { generatePassword } from './bits';

export interface MemberFormValue extends SuperadminAddMemberInput {
  /** True while "existing account" is chosen: name/password are not needed. */
  existing: boolean;
}

interface MemberFormProps {
  /** Owner on the wizard, staff on the detail page. */
  defaultRole?: MembershipRole;
  submitLabel?: string;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  onSubmit: (value: MemberFormValue) => void;
  onCancel?: () => void;
  /** Fired when the generated/typed password changes, so the wizard can keep it for the welcome e-mail. */
  onPasswordChange?: (password: string) => void;
  idPrefix?: string;
}

/**
 * "Existing user by e-mail OR create new" (wizard step 2 and detail → Members → Add). The password is typed by
 * the admin (with Generate + show) and never stored in plain text anywhere but the wizard's own session storage.
 */
export function MemberForm({ defaultRole = 'owner', submitLabel = 'Add', loading, error, compact, onSubmit, onCancel, onPasswordChange, idPrefix = 'member' }: MemberFormProps) {
  const [mode, setMode] = useState<'existing' | 'create'>('create');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [mustChange, setMustChange] = useState(true);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<MembershipRole>(defaultRole);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onPasswordChange?.(mode === 'create' ? password : '');
  }, [mode, password, onPasswordChange]);

  const generate = () => {
    setPassword(generatePassword());
    setShow(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) next.email = 'Enter a valid e-mail address';
    if (mode === 'create') {
      if (!name.trim()) next.name = 'Name is required';
      if (password.length < 8) next.password = 'At least 8 characters';
    }
    if (phone.trim() && !phoneSchema.safeParse(phone).success) next.phone = 'Enter a phone number like +381 60 123 4567';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      existing: mode === 'existing',
      email: parsedEmail.success ? parsedEmail.data : email,
      role,
      ...(mode === 'create' ? { name: name.trim(), password, mustChangePassword: mustChange } : { mustChangePassword: false }),
      phone: phone.trim() ? phone.trim() : null,
    });
  };

  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Member">
      <div role="radiogroup" aria-label="Account" className="grid grid-cols-2 gap-2">
        {(
          [
            ['create', 'Create a new account', 'I set the password; they can change it later.'],
            ['existing', 'Existing otvori account', 'Attach someone who already signed up.'],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn('flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border p-3 text-left transition-colors', mode === value ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-line-2')}
          >
            <span className="text-[13px] font-medium text-ink">{label}</span>
            {compact ? null : <span className="text-xs text-muted">{hint}</span>}
          </button>
        ))}
      </div>
      <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'grid-cols-2 max-tab:grid-cols-1')}>
        <Field label="E-mail" htmlFor={id('email')} error={errors.email} className={mode === 'existing' ? 'col-span-full' : ''}>
          <Input id={id('email')} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} invalid={Boolean(errors.email)} data-autofocus />
        </Field>
        {mode === 'create' ? (
          <Field label="Name" htmlFor={id('name')} error={errors.name}>
            <Input id={id('name')} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.name)} />
          </Field>
        ) : null}
        {mode === 'create' ? (
          <Field
            label="Password"
            htmlFor={id('password')}
            error={errors.password}
            hint="At least 8 characters. Send it to them over a channel you trust."
            trailing={
              <button type="button" onClick={generate} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-accent">
                <Icon name="sparkle" size={13} /> Generate
              </button>
            }
          >
            <div className="flex gap-1.5">
              <Input
                id={id('password')}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={Boolean(errors.password)}
                className={cn(show && 'font-mono')}
              />
              <IconButton label={show ? 'Hide password' : 'Show password'} variant="outline" size={36} onClick={() => setShow((v) => !v)} aria-pressed={show} className="shrink-0 self-center">
                <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
              </IconButton>
            </div>
          </Field>
        ) : null}
        <Field label="Role" htmlFor={id('role')}>
          <Select id={id('role')} value={role} onChange={(e) => setRole(e.target.value as MembershipRole)}>
            <option value="owner">Owner — full access</option>
            <option value="staff">Staff — service screens only</option>
          </Select>
        </Field>
        <Field label="Phone (your contact for them)" htmlFor={id('phone')} error={errors.phone} hint="Only visible in the superadmin area.">
          <Input id={id('phone')} type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={Boolean(errors.phone)} placeholder="+381 60 123 4567" />
        </Field>
        {mode === 'create' ? (
          <div className="col-span-full flex items-center justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">Must change the password on first sign-in</span>
              <span className="text-xs text-muted">Recommended when you typed the password yourself.</span>
            </div>
            <Switch label="Must change the password on first sign-in" checked={mustChange} onChange={setMustChange} size="sm" />
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-danger-text">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="primary" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
