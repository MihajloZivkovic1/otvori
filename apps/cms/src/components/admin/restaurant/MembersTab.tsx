import { useState, type FormEvent } from 'react';
import { emailSchema, type MembershipRole, type SuperadminMemberDto, type SuperadminRestaurantDetailDto, type SuperadminUserLinkDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminAddMember, useAdminInvite, useAdminRemoveMember, useAdminRevokeInvite, useAdminSetPassword, useAdminUpdateMember, useAdminUserLink } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { clock } from '../../../lib/format';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Chip';
import { Input, Select } from '../../ui/Field';
import { Menu } from '../../ui/Menu';
import { ConfirmModal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { Card, LinkModal, when } from '../bits';
import { MemberForm } from '../MemberForm';
import { SetPasswordModal } from '../SetPasswordModal';

export function MembersTab({ venue }: { venue: SuperadminRestaurantDetailDto }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const add = useAdminAddMember(venue.id);
  const updateMember = useAdminUpdateMember(venue.id);
  const removeMember = useAdminRemoveMember(venue.id);
  const invite = useAdminInvite(venue.id);
  const revokeInvite = useAdminRevokeInvite(venue.id);
  const link = useAdminUserLink();
  const setPassword = useAdminSetPassword();
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SuperadminMemberDto | null>(null);
  const [linkResult, setLinkResult] = useState<{ title: string; member: SuperadminMemberDto; result: SuperadminUserLinkDto } | null>(null);
  const [passwordFor, setPasswordFor] = useState<SuperadminMemberDto | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('staff');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const owners = venue.members.filter((m) => m.role === 'owner').length;

  const sendLink = (member: SuperadminMemberDto, kind: 'reset-password' | 'magic-link') => {
    link.mutate(
      { id: member.userId, kind },
      {
        onSuccess: (result) => setLinkResult({ title: kind === 'reset-password' ? `Password reset for ${member.name}` : `Sign-in link for ${member.name}`, member, result }),
        onError,
      },
    );
  };

  const sendInvite = (event: FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(inviteEmail);
    if (!parsed.success) {
      setInviteError('Enter a valid e-mail address');
      return;
    }
    setInviteError(null);
    invite.mutate(
      { email: parsed.data, role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail('');
          toast.success(`Invite sent to ${parsed.data}`);
        },
        onError,
      },
    );
  };

  return (
    <>
      <Card
        title="Members"
        description="Owners change everything; staff only see service screens. Last sign-in and account state are shown per person."
        actions={
          adding ? null : (
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
              Add member
            </Button>
          )
        }
      >
        {adding ? (
          <div className="rounded-[10px] border border-line bg-canvas p-4">
            <MemberForm
              defaultRole={venue.members.length === 0 ? 'owner' : 'staff'}
              submitLabel="Add member"
              loading={add.isPending}
              error={addError}
              compact={isMobile}
              onCancel={() => {
                setAdding(false);
                setAddError(null);
              }}
              onSubmit={(value) => {
                setAddError(null);
                const { existing, ...input } = value;
                void existing;
                add.mutate(input, {
                  onSuccess: (result) => {
                    setAdding(false);
                    toast.success(result.created ? `${result.member.name} created and added as ${result.member.role}` : `${result.member.name} added as ${result.member.role}`);
                  },
                  onError: (error) => setAddError(errorMessage(error)),
                });
              }}
            />
          </div>
        ) : null}
        <ul aria-label="Members" className="-mx-5 -mb-5 flex flex-col border-t border-line-2">
          {venue.members.length === 0 ? <li className="px-5 py-6 text-center text-[13px] text-muted">No members yet. The wizard adds the owner in step 2.</li> : null}
          {venue.members.map((member) => (
            <li key={member.membershipId} className="flex min-h-14 items-center gap-3 border-b border-line-2 px-5 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{member.name}</span>
                  {member.deactivatedAt ? <Badge className="bg-[#FEF2F2] text-danger-text">DEACTIVATED</Badge> : null}
                  {member.mustChangePassword ? <Badge>MUST CHANGE PASSWORD</Badge> : null}
                  {!member.hasPassword ? <Badge>NO PASSWORD</Badge> : null}
                </div>
                <div className="truncate text-xs text-muted">
                  {member.email}
                  {member.phone ? ` · ${member.phone}` : ''}
                  {!member.hasRealEmail ? ' · join-code account' : ''}
                  {` · last sign-in ${when(member.lastLoginAt).toLowerCase()}`}
                </div>
              </div>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.04em]', member.role === 'owner' ? 'bg-accent-soft text-accent' : 'bg-line-2 text-ink-2')}>{member.role}</span>
              <Menu
                items={[
                  member.role === 'staff'
                    ? { label: 'Make owner', onSelect: () => updateMember.mutate({ membershipId: member.membershipId, input: { role: 'owner' } }, { onError }) }
                    : { label: 'Make staff', disabled: owners <= 1, onSelect: () => updateMember.mutate({ membershipId: member.membershipId, input: { role: 'staff' } }, { onError }) },
                  { label: 'Send password reset link', disabled: Boolean(member.deactivatedAt), onSelect: () => sendLink(member, 'reset-password') },
                  { label: 'Send magic sign-in link', disabled: Boolean(member.deactivatedAt), onSelect: () => sendLink(member, 'magic-link') },
                  { label: 'Set a password…', onSelect: () => setPasswordFor(member) },
                  { label: 'Remove from venue', danger: true, disabled: member.role === 'owner' && owners <= 1, onSelect: () => setRemoving(member) },
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
      </Card>

      <Card title="Invite by e-mail" description="They get a sign-in link valid for 7 days; an existing otvori account is added straight away. Sending again resends.">
        <form onSubmit={sendInvite} noValidate className={cn('flex gap-2', isMobile && 'flex-col')} aria-label="Invite by e-mail">
          <Input type="email" inputMode="email" autoComplete="off" placeholder="konobar@primer.rs" aria-label="E-mail address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} invalid={Boolean(inviteError)} className="min-w-0 flex-1" />
          <Select aria-label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MembershipRole)} className={isMobile ? '' : 'w-28'}>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </Select>
          <Button type="submit" variant="primary" loading={invite.isPending} disabled={!inviteEmail}>
            Invite
          </Button>
        </form>
        {inviteError ? (
          <span role="alert" className="text-xs text-danger-text">
            {inviteError}
          </span>
        ) : null}
        {venue.invites.length > 0 ? (
          <ul aria-label="Pending invites" className="flex flex-col gap-1.5">
            {venue.invites.map((pending) => (
              <li key={pending.id} className="flex items-center gap-2 text-[13px]">
                <span className="truncate text-ink-2">{pending.email}</span>
                <Badge>{pending.role.toUpperCase()}</Badge>
                <span className="text-xs text-faint">
                  expires {new Date(pending.expiresAt).toLocaleDateString('en-GB')} {clock(pending.expiresAt)}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" loading={invite.isPending} onClick={() => invite.mutate({ email: pending.email, role: pending.role }, { onSuccess: () => toast.success(`Invite resent to ${pending.email}`), onError })}>
                    Resend
                  </Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => revokeInvite.mutate(pending.id, { onError })}>
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          removeMember.mutate(removing.membershipId, {
            onSuccess: () => {
              toast.success(`${removing.name} removed from ${venue.name}`);
              setRemoving(null);
            },
            onError,
          })
        }
        title={`Remove ${removing?.name ?? 'member'} from ${venue.name}?`}
        description="They lose access to this venue immediately. Their account and their other venues are not affected."
        confirmLabel="Remove"
        danger
        loading={removeMember.isPending}
      />
      {linkResult ? (
        <LinkModal
          title={linkResult.title}
          description={`Hand this link to ${linkResult.member.name} (${linkResult.member.email}).`}
          url={linkResult.result.url}
          expiresAt={linkResult.result.expiresAt}
          mailed={linkResult.result.mailed}
          onClose={() => setLinkResult(null)}
        />
      ) : null}
      {passwordFor ? (
        <SetPasswordModal
          name={passwordFor.name}
          loading={setPassword.isPending}
          onClose={() => setPasswordFor(null)}
          onSubmit={(input) =>
            setPassword.mutate(
              { id: passwordFor.userId, input },
              {
                onSuccess: () => {
                  toast.success(`Password set for ${passwordFor.name}; other devices are signed out`);
                  setPasswordFor(null);
                },
                onError,
              },
            )
          }
        />
      ) : null}
    </>
  );
}
