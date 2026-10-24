import { useState, type FormEvent } from 'react';
import { emailSchema, type MembershipRole, type TeamMemberDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { clock } from '../../lib/format';
import { useCreateInvite, useCreateJoinCode, useRemoveMember, useRevokeInvite, useRevokeJoinCode, useTeam, useUpdateMember } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Input, Select } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { ConfirmModal } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

/**
 * Settings → "Team" (owner): members with roles, e-mail invites (magic link) and the 6-digit join code a waiter
 * types on the sign-in screen to create a staff account in 30 seconds.
 */
export function TeamCard() {
  const { restaurant, isMobile } = useRestaurantContext();
  const toast = useToast();
  const team = useTeam(restaurant.id);
  const invite = useCreateInvite(restaurant.id);
  const revokeInvite = useRevokeInvite(restaurant.id);
  const updateMember = useUpdateMember(restaurant.id);
  const removeMember = useRemoveMember(restaurant.id);
  const createCode = useCreateJoinCode(restaurant.id);
  const revokeCode = useRevokeJoinCode(restaurant.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('staff');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMemberDto | null>(null);
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const sendInvite = (event: FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError('Enter a valid e-mail address');
      return;
    }
    setEmailError(null);
    invite.mutate(
      { email: parsed.data, role },
      {
        onSuccess: () => {
          setEmail('');
          toast.success(`Invite sent to ${parsed.data}`);
        },
        onError,
      },
    );
  };

  const members = team.data?.members ?? [];
  const invites = team.data?.invites ?? [];
  const joinCode = team.data?.joinCode ?? null;
  const owners = members.filter((m) => m.role === 'owner').length;

  return (
    <section aria-labelledby="team-title" className={cn('flex flex-col bg-surface', isMobile ? 'border-y border-line' : 'rounded-[10px] border border-line')}>
      <div className="flex flex-col gap-1 border-b border-line-2 px-5 pb-4 pt-5">
        <h2 id="team-title" className="text-base font-semibold">
          Team
        </h2>
        <p className="text-[13px] text-pretty text-muted">
          Staff sign in on their own phones and only see service screens: orders, calls, “unavailable today”, tables. No PIN needed. Owners can change everything.
        </p>
      </div>

      <ul aria-label="Members" className="flex flex-col">
        {team.isPending
          ? [0, 1].map((i) => (
              <li key={i} className="flex h-14 items-center gap-3 border-b border-line-2 px-5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="ml-auto h-3 w-12" />
              </li>
            ))
          : members.map((member) => (
              <li key={member.membershipId} className="flex min-h-14 items-center gap-3 border-b border-line-2 px-5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{member.name}</span>
                    {member.isSelf ? <Badge>YOU</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {member.email}
                    {!member.hasRealEmail ? ' · sign-in name from a join code' : ''}
                  </div>
                </div>
                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.04em]', member.role === 'owner' ? 'bg-accent-soft text-accent' : 'bg-line-2 text-ink-2')}>
                  {member.role}
                </span>
                <Menu
                  items={[
                    member.role === 'staff'
                      ? { label: 'Make owner', onSelect: () => updateMember.mutate({ membershipId: member.membershipId, input: { role: 'owner' } }, { onError }) }
                      : { label: 'Make staff', disabled: owners <= 1, onSelect: () => updateMember.mutate({ membershipId: member.membershipId, input: { role: 'staff' } }, { onError }) },
                    { label: member.isSelf ? 'Leave venue' : 'Remove', danger: true, disabled: member.role === 'owner' && owners <= 1, onSelect: () => setRemoving(member) },
                  ]}
                  trigger={(props) => (
                    <Button size="sm" aria-label={`Actions for ${member.name}`} {...props}>
                      ···
                    </Button>
                  )}
                />
              </li>
            ))}
      </ul>

      <form onSubmit={sendInvite} noValidate className="flex flex-col gap-2 border-b border-line-2 px-5 py-4" aria-label="Invite by e-mail">
        <div className="text-sm font-medium">Invite by e-mail</div>
        <div className={cn('flex gap-2', isMobile && 'flex-col')}>
          <Input type="email" inputMode="email" autoComplete="off" placeholder="konobar@primer.rs" aria-label="E-mail address" value={email} onChange={(e) => setEmail(e.target.value)} invalid={Boolean(emailError)} className="min-w-0 flex-1" />
          <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as MembershipRole)} className={isMobile ? '' : 'w-28'}>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </Select>
          <Button type="submit" variant="primary" loading={invite.isPending} disabled={!email}>
            Invite
          </Button>
        </div>
        {emailError ? (
          <span role="alert" className="text-xs text-danger-text">
            {emailError}
          </span>
        ) : (
          <span className="text-xs text-faint">They get a sign-in link valid for 7 days; an existing otvori account is added straight away.</span>
        )}
        {invites.length > 0 ? (
          <ul aria-label="Pending invites" className="mt-1 flex flex-col gap-1">
            {invites.map((pending) => (
              <li key={pending.id} className="flex items-center gap-2 text-[13px]">
                <span className="truncate text-ink-2">{pending.email}</span>
                <Badge>{pending.role.toUpperCase()}</Badge>
                <span className="text-xs text-faint">pending</span>
                <button type="button" className="ml-auto cursor-pointer text-xs font-medium text-danger-text" onClick={() => revokeInvite.mutate(pending.id, { onError })}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <div className="flex flex-col gap-2 px-5 py-4" aria-label="Join code">
        <div className="text-sm font-medium">Waiter account with a join code</div>
        <p className="text-[13px] text-pretty text-muted">
          For waiters without e-mail: generate a 6-digit code, they tap “Join with a code” on the sign-in screen, enter it with their name and a password, and have a staff account in 30 seconds. The code works for 24 hours.
        </p>
        {joinCode ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-canvas px-4 py-3">
            <span className="font-mono text-2xl font-semibold tracking-[.25em] text-ink" aria-label={`Join code ${joinCode.code.split('').join(' ')}`}>
              {joinCode.code}
            </span>
            <span className="text-xs text-muted">valid until {new Date(joinCode.expiresAt).toLocaleDateString('en-GB')} {clock(joinCode.expiresAt)}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={() => createCode.mutate(undefined, { onError })} loading={createCode.isPending}>
                New code
              </Button>
              <Button size="sm" variant="danger-ghost" onClick={() => revokeCode.mutate(undefined, { onError })} loading={revokeCode.isPending}>
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button onClick={() => createCode.mutate(undefined, { onError })} loading={createCode.isPending}>
              Generate join code
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          removeMember.mutate(removing.membershipId, {
            onSuccess: () => {
              toast.success(`${removing.name} removed`);
              setRemoving(null);
            },
            onError,
          })
        }
        title={removing?.isSelf ? 'Leave this venue?' : `Remove ${removing?.name ?? 'member'}?`}
        description={removing?.isSelf ? 'You will lose access to it immediately.' : 'They lose access immediately. Their past actions stay in the change history.'}
        confirmLabel={removing?.isSelf ? 'Leave' : 'Remove'}
        danger
        loading={removeMember.isPending}
      />
    </section>
  );
}
