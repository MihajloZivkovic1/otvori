import { useState } from 'react';
import { emailSchema, type SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminAddMember, useAdminInvite } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Chip';
import { Input } from '../../ui/Field';
import { useToast } from '../../ui/Toast';
import { MemberForm } from '../MemberForm';
import { onboardingDraft } from './modals';

/** Step 2: the owner (existing account or a new one with an admin-set password) and optional staff invites. */
export function OwnerStep({ venue, onNext }: { venue: SuperadminRestaurantDetailDto; onNext: () => void }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const add = useAdminAddMember(venue.id);
  const invite = useAdminInvite(venue.id);
  const [error, setError] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);
  const owners = venue.members.filter((m) => m.role === 'owner');
  const [adding, setAdding] = useState(owners.length === 0);

  const sendStaffInvite = () => {
    const parsed = emailSchema.safeParse(staffEmail);
    if (!parsed.success) {
      setStaffError('Enter a valid e-mail address');
      return;
    }
    setStaffError(null);
    invite.mutate(
      { email: parsed.data, role: 'staff' },
      {
        onSuccess: () => {
          setStaffEmail('');
          toast.success(`Invite sent to ${parsed.data}`);
        },
        onError: (err) => setStaffError(errorMessage(err)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {venue.members.length > 0 ? (
        <ul aria-label="Members" className="flex flex-col divide-y divide-line-2 rounded-[10px] border border-line bg-surface">
          {venue.members.map((member) => (
            <li key={member.membershipId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{member.name}</div>
                <div className="truncate text-xs text-muted">
                  {member.email}
                  {member.phone ? ` · ${member.phone}` : ''}
                </div>
              </div>
              {member.mustChangePassword ? <Badge>MUST CHANGE PW</Badge> : null}
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.04em]', member.role === 'owner' ? 'bg-accent-soft text-accent' : 'bg-line-2 text-ink-2')}>{member.role}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">{owners.length === 0 ? 'The owner' : 'Another member'}</h3>
          <MemberForm
            defaultRole={owners.length === 0 ? 'owner' : 'staff'}
            submitLabel={owners.length === 0 ? 'Add owner' : 'Add member'}
            loading={add.isPending}
            error={error}
            compact={isMobile}
            onCancel={owners.length > 0 ? () => setAdding(false) : undefined}
            onSubmit={(value) => {
              setError(null);
              const { existing, ...input } = value;
              add.mutate(input, {
                onSuccess: (result) => {
                  if (!existing && input.password && result.member.role === 'owner') onboardingDraft.set(venue.id, { ownerPassword: input.password, ownerEmail: result.member.email });
                  setAdding(false);
                  toast.success(result.created ? `${result.member.name} created as ${result.member.role}` : `${result.member.name} added as ${result.member.role}`);
                },
                onError: (err) => setError(errorMessage(err)),
              });
            }}
          />
        </div>
      ) : (
        <div>
          <Button onClick={() => setAdding(true)}>Add another member</Button>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">Staff by e-mail (optional)</h3>
        <p className="text-[13px] text-muted">Waiters get a sign-in link valid for 7 days. They can also join later with a code from the owner’s Team card.</p>
        <div className={cn('flex gap-2', isMobile && 'flex-col')}>
          <Input type="email" inputMode="email" aria-label="Staff e-mail" placeholder="konobar@primer.rs" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} invalid={Boolean(staffError)} className="min-w-0 flex-1" />
          <Button loading={invite.isPending} disabled={!staffEmail} onClick={sendStaffInvite}>
            Send invite
          </Button>
        </div>
        {staffError ? (
          <span role="alert" className="text-xs text-danger-text">
            {staffError}
          </span>
        ) : null}
        {venue.invites.length ? (
          <ul aria-label="Pending invites" className="flex flex-wrap gap-1.5 text-[13px]">
            {venue.invites.map((pending) => (
              <li key={pending.id} className="rounded-md bg-line-2 px-2 py-0.5 text-ink-2">
                {pending.email} <span className="text-faint">· pending</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size={isMobile ? 'lg' : 'md'} disabled={owners.length === 0} title={owners.length === 0 ? 'Add the owner first' : undefined} onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
