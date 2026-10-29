import { useState } from 'react';
import type { SuperadminSetPasswordInput } from '@qr-menu/shared';
import { Icon } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { CopyButton, generatePassword } from './bits';

/** "Set a password…" for an account (the admin types or generates it; other devices are signed out). */
export function SetPasswordModal({ name, loading, onClose, onSubmit }: { name: string; loading?: boolean; onClose: () => void; onSubmit: (input: SuperadminSetPasswordInput) => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [show, setShow] = useState(true);
  const [mustChange, setMustChange] = useState(true);
  const valid = password.length >= 8;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Set a password for ${name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={loading} onClick={() => onSubmit({ password, mustChangePassword: mustChange })}>
            Set password
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        <p>Every other device of this account is signed out. Send the password over a channel you trust.</p>
        <Field
          label="New password"
          htmlFor="set-password"
          hint="At least 8 characters."
          trailing={
            <button type="button" onClick={() => { setPassword(generatePassword()); setShow(true); }} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-accent">
              <Icon name="sparkle" size={13} /> Generate
            </button>
          }
        >
          <div className="flex gap-1.5">
            <Input id="set-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={show ? 'font-mono' : ''} data-autofocus />
            <IconButton label={show ? 'Hide password' : 'Show password'} variant="outline" size={36} onClick={() => setShow((v) => !v)} aria-pressed={show} className="shrink-0 self-center">
              <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
            </IconButton>
            <CopyButton value={password} size="md" />
          </div>
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
          <span className="text-[13px] font-medium text-ink">Must change it on the next sign-in</span>
          <Switch label="Must change it on the next sign-in" checked={mustChange} onChange={setMustChange} size="sm" />
        </div>
      </div>
    </Modal>
  );
}
