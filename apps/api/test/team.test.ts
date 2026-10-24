import { describe, expect, it } from 'vitest';
import { AuditLog, TeamInvite } from '../src/db/models/index.js';
import { outbox } from '../src/utils/mailer.js';
import { addStaff, api, bearer, registerUser } from './helpers.js';

describe('team (Phase 11)', () => {
  it('invites a new person by e-mail: the link creates the account, the membership and a session', async () => {
    const owner = await registerUser({ name: 'Ana' });
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const invite = await api.post(`${base}/team/invites`).set(bearer(owner.accessToken)).send({ email: 'marko@example.com' });
    expect(invite.status).toBe(201);
    expect(invite.body.invites).toHaveLength(1);
    expect(invite.body.invites[0].email).toBe('marko@example.com');
    expect(invite.body.invites[0].role).toBe('staff');

    const mail = outbox.find((m) => m.to === 'marko@example.com');
    expect(mail?.subject).toContain('Ana invited you');
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mail!.text)![1]!);

    const preview = await api.get(`/api/auth/invite/${encodeURIComponent(token)}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ role: 'staff', email: 'marko@example.com', existingUser: false });

    const missingName = await api.post('/api/auth/invite').send({ token });
    expect(missingName.status).toBe(400);

    const accepted = await api.post('/api/auth/invite').send({ token, name: 'Marko', password: 'password123' });
    expect(accepted.status).toBe(201);
    expect(accepted.body.memberships).toHaveLength(1);
    expect(accepted.body.memberships[0].role).toBe('staff');
    expect(accepted.body.memberships[0].restaurant.id).toBe(owner.restaurantId);

    // One-time: the link is dead afterwards; the pending invite is gone from the team list.
    expect((await api.post('/api/auth/invite').send({ token, name: 'Marko' })).status).toBe(410);
    const team = await api.get(`${base}/team`).set(bearer(owner.accessToken));
    expect(team.body.invites).toHaveLength(0);
    expect(team.body.members.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual(
      expect.arrayContaining([[owner.email, 'owner'], ['marko@example.com', 'staff']]),
    );
    const login = await api.post('/api/auth/login').send({ email: 'marko@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    const actions = (await AuditLog.findAll({ where: { restaurantId: owner.restaurantId } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['team.invite', 'team.join', 'auth.login']));
  });

  it('adds an existing account straight away, and can revoke a pending invite', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    await api.post(`${base}/team/invites`).set(bearer(owner.accessToken)).send({ email: other.email, role: 'owner' });
    const token = decodeURIComponent(/token=([^\s]+)/.exec(outbox.find((m) => m.to === other.email)!.text)![1]!);
    const preview = await api.get(`/api/auth/invite/${encodeURIComponent(token)}`);
    expect(preview.body.existingUser).toBe(true);
    const accepted = await api.post('/api/auth/invite').send({ token });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user.id).toBe(other.user.id);
    expect(accepted.body.memberships).toHaveLength(2);

    const again = await api.post(`${base}/team/invites`).set(bearer(owner.accessToken)).send({ email: other.email });
    expect(again.status).toBe(409);

    const pending = await api.post(`${base}/team/invites`).set(bearer(owner.accessToken)).send({ email: 'pending@example.com' });
    const inviteId = pending.body.invites[0].id as string;
    const revoked = await api.delete(`${base}/team/invites/${inviteId}`).set(bearer(owner.accessToken));
    expect(revoked.status).toBe(200);
    expect(revoked.body.invites).toHaveLength(0);
    const token2 = decodeURIComponent(/token=([^\s]+)/.exec(outbox.find((m) => m.to === 'pending@example.com')!.text)![1]!);
    expect((await api.get(`/api/auth/invite/${encodeURIComponent(token2)}`)).status).toBe(410);
  });

  it('join code: a waiter without e-mail gets a staff account in one step', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija Dorćol' });
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const code = await api.post(`${base}/team/join-code`).set(bearer(owner.accessToken));
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^\d{6}$/);
    const team = await api.get(`${base}/team`).set(bearer(owner.accessToken));
    expect(team.body.joinCode.code).toBe(code.body.code);

    const wrong = await api.post('/api/auth/join').send({ code: '000000', name: 'Pera', password: 'password123' });
    expect([404, 409]).toContain(wrong.status);
    const joined = await api.post('/api/auth/join').send({ code: code.body.code, name: 'Pera Perić', password: 'password123' });
    expect(joined.status).toBe(201);
    expect(joined.body.user.email).toBe('pera.peric@kafeterija-dorcol.staff.otvori.menu');
    expect(joined.body.memberships[0].role).toBe('staff');
    const twin = await api.post('/api/auth/join').send({ code: code.body.code, name: 'Pera Perić', password: 'password123' });
    expect(twin.status).toBe(201);
    expect(twin.body.user.email).toBe('pera.peric2@kafeterija-dorcol.staff.otvori.menu');
    const withEmail = await api.post('/api/auth/join').send({ code: code.body.code, name: 'Mila', email: 'mila@example.com', password: 'password123' });
    expect(withEmail.body.user.email).toBe('mila@example.com');

    const members = (await api.get(`${base}/team`).set(bearer(owner.accessToken))).body.members as { email: string; hasRealEmail: boolean }[];
    expect(members.find((m) => m.email.startsWith('pera.peric@'))?.hasRealEmail).toBe(false);
    expect(members.find((m) => m.email === 'mila@example.com')?.hasRealEmail).toBe(true);

    // A new code retires the old one; revoking leaves none.
    const second = await api.post(`${base}/team/join-code`).set(bearer(owner.accessToken));
    expect((await api.post('/api/auth/join').send({ code: code.body.code, name: 'Late', password: 'password123' })).status).toBe(404);
    expect((await api.post('/api/auth/join').send({ code: second.body.code, name: 'Late', password: 'password123' })).status).toBe(201);
    const cleared = await api.delete(`${base}/team/join-code`).set(bearer(owner.accessToken));
    expect(cleared.body.joinCode).toBeNull();
    expect(await TeamInvite.count({ where: { restaurantId: owner.restaurantId, kind: 'code', revokedAt: null } })).toBe(0);
  });

  it('promotes, demotes and removes members but never the last owner', async () => {
    const owner = await registerUser();
    const staff = await addStaff(owner);
    const base = `/api/admin/restaurants/${owner.restaurantId}`;
    const team = await api.get(`${base}/team`).set(bearer(owner.accessToken));
    const ownerRow = team.body.members.find((m: { isSelf: boolean }) => m.isSelf);
    const staffRow = team.body.members.find((m: { isSelf: boolean }) => !m.isSelf);

    const demoteSelf = await api.patch(`${base}/team/${ownerRow.membershipId}`).set(bearer(owner.accessToken)).send({ role: 'staff' });
    expect(demoteSelf.status).toBe(409);
    expect(demoteSelf.body.error.code).toBe('LAST_OWNER');
    const removeSelf = await api.delete(`${base}/team/${ownerRow.membershipId}`).set(bearer(owner.accessToken));
    expect(removeSelf.status).toBe(409);

    const promote = await api.patch(`${base}/team/${staffRow.membershipId}`).set(bearer(owner.accessToken)).send({ role: 'owner' });
    expect(promote.status).toBe(200);
    expect(promote.body.members.filter((m: { role: string }) => m.role === 'owner')).toHaveLength(2);
    // With two owners the first one may step down.
    expect((await api.patch(`${base}/team/${ownerRow.membershipId}`).set(bearer(owner.accessToken)).send({ role: 'staff' })).status).toBe(200);
    // …and is now staff: team management is closed.
    expect((await api.get(`${base}/team`).set(bearer(owner.accessToken))).status).toBe(403);

    const removed = await api.delete(`${base}/team/${ownerRow.membershipId}`).set(bearer(staff.accessToken));
    expect(removed.status).toBe(200);
    expect(removed.body.members).toHaveLength(1);
    expect((await api.get(base).set(bearer(owner.accessToken))).status).toBe(403);
  });
});
