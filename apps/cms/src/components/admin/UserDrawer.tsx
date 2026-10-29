import { useState } from 'react';
import { useNavigate } from 'react-router';
import { phoneSchema, type SuperadminUserDto } from '@qr-menu/shared';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAdminUpdateUser, useAdminUser } from '../../lib/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/EmptyState';
import { Field, Input } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { Facts, when } from './bits';

/** One account: editable name/phone, flags, and its venues (links to the venue pages). */
export function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const isMobile = useIsMobile();
  const query = useAdminUser(userId);
  const user = query.data;

  const body = query.isPending ? (
    <div role="status" aria-busy="true" aria-label="Loading account" className="flex flex-col gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : query.isError || !user ? (
    <EmptyState variant="inline" icon="warning" title="Could not load this account" description={errorMessage(query.error)} />
  ) : (
    <UserDetails key={`${user.id}:${user.name}:${user.phone ?? ''}`} user={user} onClose={onClose} />
  );

  const title = user?.name ?? 'Account';
  if (isMobile) {
    return (
      <Sheet open onClose={onClose} title={title} variant="bottom">
        <div className="pb-4">{body}</div>
      </Sheet>
    );
  }
  return (
    <Drawer open onClose={onClose} title={title}>
      {body}
    </Drawer>
  );
}

function UserDetails({ user, onClose }: { user: SuperadminUserDto; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const update = useAdminUpdateUser();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== user.name || phone.trim() !== (user.phone ?? '');

  const save = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (phone.trim() && !phoneSchema.safeParse(phone).success) {
      setError('Enter a phone number like +381 60 123 4567');
      return;
    }
    setError(null);
    update.mutate(
      { id: user.id, input: { name: name.trim(), phone: phone.trim() ? phone.trim() : null } },
      { onSuccess: () => toast.success('Account updated'), onError: (err) => toast.error(errorMessage(err)) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {user.isSuperadmin ? <Badge className="bg-accent-soft text-accent">SUPERADMIN</Badge> : null}
        {user.deactivatedAt ? <Badge className="bg-[#FEF2F2] text-danger-text">DEACTIVATED</Badge> : <Badge>ACTIVE</Badge>}
        {user.mustChangePassword ? <Badge>MUST CHANGE PASSWORD</Badge> : null}
        {!user.hasPassword ? <Badge>NO PASSWORD (MAGIC LINK ONLY)</Badge> : null}
        {!user.hasRealEmail ? <Badge>JOIN-CODE ACCOUNT</Badge> : null}
      </div>
      <Facts
        items={[
          { label: 'E-mail', value: user.email },
          { label: 'Last sign-in', value: when(user.lastLoginAt) },
          { label: 'Created', value: new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
          ...(user.deactivatedAt ? [{ label: 'Deactivated', value: when(user.deactivatedAt) }] : []),
        ]}
      />
      <div className="flex flex-col gap-3 border-t border-line-2 pt-4">
        <Field label="Name" htmlFor="user-name" error={error && error.startsWith('Name') ? error : undefined}>
          <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Phone (your contact)" htmlFor="user-phone" error={error && error.startsWith('Enter') ? error : undefined} hint="Only visible here.">
          <Input id="user-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+381 60 123 4567" />
        </Field>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" disabled={!dirty} loading={update.isPending} onClick={save}>
            Save
          </Button>
          <Button size="sm" disabled={!dirty} onClick={() => { setName(user.name); setPhone(user.phone ?? ''); setError(null); }}>
            Reset
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line-2 pt-4">
        <h3 className="text-[13px] font-semibold">Venues</h3>
        {user.memberships.length === 0 ? <p className="text-[13px] text-muted">Not a member of any venue.</p> : null}
        <ul className="flex flex-col gap-1">
          {user.memberships.map((m) => (
            <li key={m.membershipId}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/admin/restaurants/${m.restaurant.id}/members`);
                }}
                className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[13px] text-ink hover:bg-line-2"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{m.restaurant.name}</span>
                <span className="text-xs text-muted">{m.restaurant.status}</span>
                <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.04em]', m.role === 'owner' ? 'bg-accent-soft text-accent' : 'bg-line-2 text-ink-2')}>{m.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
