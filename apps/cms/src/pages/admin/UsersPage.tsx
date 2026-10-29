import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { USER_SORT_KEYS, type SuperadminUserDto, type SuperadminUserLinkDto, type UserSortKey } from '@qr-menu/shared';
import { LinkModal, when } from '../../components/admin/bits';
import { SetPasswordModal } from '../../components/admin/SetPasswordModal';
import { UserDrawer } from '../../components/admin/UserDrawer';
import { Icon } from '../../components/icons';
import { MobileHeader, PageHeader } from '../../components/shell/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Chip';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useDebounced } from '../../hooks/useDebounced';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAdminSetPassword, useAdminUpdateUser, useAdminUserAction, useAdminUserLink, useAdminUsers } from '../../lib/admin';
import { useMe } from '../../lib/auth';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 50;

/** /admin/users — every account across venues. Row click opens the drawer; the menu holds the one-way doors. */
export function UsersPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const me = useMe();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const filter = params.get('filter') ?? '';
  const sort = ((USER_SORT_KEYS as readonly string[]).includes(params.get('sort') ?? '') ? params.get('sort') : 'createdAt') as UserSortKey;
  const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const search = useDebounced(q.trim(), 300);
  const selectedId = params.get('user');

  const set = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const query = useMemo(
    () => ({ search: search || undefined, superadmin: filter === 'superadmin' ? true : undefined, deactivated: filter === 'deactivated' ? true : filter === 'active' ? false : undefined, sort, dir, page, pageSize: PAGE_SIZE }),
    [search, filter, sort, dir, page],
  );
  const list = useAdminUsers(query);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const link = useAdminUserLink();
  const action = useAdminUserAction();
  const update = useAdminUpdateUser();
  const setPassword = useAdminSetPassword();
  const [linkResult, setLinkResult] = useState<{ title: string; user: SuperadminUserDto; result: SuperadminUserLinkDto } | null>(null);
  const [passwordFor, setPasswordFor] = useState<SuperadminUserDto | null>(null);
  const [deactivating, setDeactivating] = useState<SuperadminUserDto | null>(null);
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const sendLink = (user: SuperadminUserDto, kind: 'reset-password' | 'magic-link') =>
    link.mutate({ id: user.id, kind }, { onSuccess: (result) => setLinkResult({ title: kind === 'reset-password' ? `Password reset for ${user.name}` : `Sign-in link for ${user.name}`, user, result }), onError });

  const rowMenu = (user: SuperadminUserDto) => (
    <Menu
      items={[
        { label: 'Send password reset link', disabled: Boolean(user.deactivatedAt), onSelect: () => sendLink(user, 'reset-password') },
        { label: 'Send magic sign-in link', disabled: Boolean(user.deactivatedAt), onSelect: () => sendLink(user, 'magic-link') },
        { label: 'Set a password…', onSelect: () => setPasswordFor(user) },
        {
          label: user.isSuperadmin ? 'Remove superadmin access' : 'Make superadmin',
          disabled: user.id === me.user.id,
          onSelect: () => update.mutate({ id: user.id, input: { isSuperadmin: !user.isSuperadmin } }, { onSuccess: (next) => toast.success(next.isSuperadmin ? `${next.name} is now a superadmin` : `${next.name} is no longer a superadmin`), onError }),
        },
        user.deactivatedAt
          ? { label: 'Reactivate', onSelect: () => action.mutate({ id: user.id, action: 'activate' }, { onSuccess: () => toast.success(`${user.name} reactivated`), onError }) }
          : { label: 'Deactivate…', danger: true, disabled: user.id === me.user.id || user.isSuperadmin, onSelect: () => setDeactivating(user) },
      ]}
      trigger={(props) => (
        <Button size="sm" aria-label={`Actions for ${user.name}`} onClick={(event) => { event.stopPropagation(); props.onClick(); }} aria-expanded={props['aria-expanded']} aria-haspopup={props['aria-haspopup']} aria-controls={props['aria-controls']}>
          ···
        </Button>
      )}
    />
  );

  const columns: Column<SuperadminUserDto>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (user) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-ink">{user.name}</span>
            {user.isSuperadmin ? <Badge className="bg-accent-soft text-accent">SUPERADMIN</Badge> : null}
            {user.deactivatedAt ? <Badge className="bg-[#FEF2F2] text-danger-text">DEACTIVATED</Badge> : null}
            {user.mustChangePassword ? <Badge>MUST CHANGE PW</Badge> : null}
          </div>
          <div className="truncate text-xs text-muted">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'venues',
      header: 'Venues',
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.memberships.length === 0 ? <span className="text-muted">—</span> : null}
          {user.memberships.slice(0, 3).map((m) => (
            <button
              key={m.membershipId}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/admin/restaurants/${m.restaurant.id}`);
              }}
              className={cn('inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs hover:bg-line', m.role === 'owner' ? 'bg-accent-soft text-ink' : 'bg-line-2 text-ink-2')}
            >
              <span className="max-w-[140px] truncate">{m.restaurant.name}</span>
              <span className="text-[10px] uppercase tracking-[.04em] text-muted">{m.role}</span>
            </button>
          ))}
          {user.memberships.length > 3 ? <span className="text-xs text-muted">+{user.memberships.length - 3}</span> : null}
        </div>
      ),
    },
    { key: 'lastLoginAt', header: 'Last sign-in', sortable: true, align: 'right', width: '130px', cell: (user) => <span className="text-muted">{when(user.lastLoginAt)}</span> },
    { key: 'createdAt', header: 'Created', sortable: true, align: 'right', width: '120px', className: 'max-wide:hidden', cell: (user) => <span className="text-muted">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', width: '56px', cell: (user) => <span onClick={(event) => event.stopPropagation()}>{rowMenu(user)}</span> },
  ];

  const filters = (
    <div className={cn('flex flex-wrap gap-2', isMobile && 'px-4')}>
      <Input
        type="search"
        aria-label="Search users"
        placeholder="Name, e-mail or phone"
        value={q}
        onChange={(event) => set({ q: event.target.value })}
        controlSize={isMobile ? 'lg' : 'md'}
        className={isMobile ? 'w-full' : 'h-9 w-[280px] text-[13px]'}
      />
      <Select aria-label="Filter" value={filter} onChange={(event) => set({ filter: event.target.value })} className={isMobile ? 'flex-1' : 'h-9 w-[160px] text-[13px]'}>
        <option value="">Everyone</option>
        <option value="active">Active only</option>
        <option value="superadmin">Superadmins</option>
        <option value="deactivated">Deactivated</option>
      </Select>
    </div>
  );

  return (
    <div className={cn('flex flex-1 flex-col', isMobile ? 'gap-3 pb-6' : 'gap-4 p-6')}>
      {isMobile ? <MobileHeader large title="Users" /> : <PageHeader title="Users" subtitle={list.data ? `${total} ${total === 1 ? 'account' : 'accounts'} across every venue.` : 'Every account across every venue.'} />}
      {filters}
      <DataTable
        ariaLabel="Users"
        columns={columns}
        rows={rows}
        rowKey={(user) => user.id}
        sort={{ key: sort, dir }}
        onSort={(key) => (key === sort ? set({ dir: dir === 'asc' ? 'desc' : 'asc' }) : set({ sort: key, dir: key === 'name' || key === 'email' ? 'asc' : 'desc' }))}
        onRowClick={(user) => set({ user: user.id }, false)}
        rowLabel={(user) => `Open ${user.name}`}
        loading={list.isPending}
        error={list.isError ? list.error : undefined}
        errorMessage={(error) => errorMessage(error, 'Could not load users')}
        onRetry={() => void list.refetch()}
        dimmed={list.isPlaceholderData}
        empty={<EmptyState variant="inline" title={search || filter ? 'No accounts match.' : 'No accounts yet.'} />}
        pagination={{ page, pageSize: PAGE_SIZE, total, onPage: (next) => set({ page: String(next) }, false) }}
        mobile={isMobile}
        mobileRow={(user) => (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-line text-[12px] font-semibold text-ink-2" aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-medium">{user.name}</span>
                {user.isSuperadmin ? <Badge className="bg-accent-soft text-accent">SA</Badge> : null}
                {user.deactivatedAt ? <Badge className="bg-[#FEF2F2] text-danger-text">OFF</Badge> : null}
              </span>
              <span className="truncate text-xs text-muted">
                {user.email} · {user.memberships.length} {user.memberships.length === 1 ? 'venue' : 'venues'}
              </span>
            </span>
            <Icon name="chevronRight" size={16} strokeWidth={1.8} className="shrink-0 text-muted" />
          </>
        )}
      />
      {selectedId ? <UserDrawer userId={selectedId} onClose={() => set({ user: null }, false)} /> : null}
      {linkResult ? (
        <LinkModal title={linkResult.title} description={`Hand this link to ${linkResult.user.name} (${linkResult.user.email}).`} url={linkResult.result.url} expiresAt={linkResult.result.expiresAt} mailed={linkResult.result.mailed} onClose={() => setLinkResult(null)} />
      ) : null}
      {passwordFor ? (
        <SetPasswordModal
          name={passwordFor.name}
          loading={setPassword.isPending}
          onClose={() => setPasswordFor(null)}
          onSubmit={(input) =>
            setPassword.mutate(
              { id: passwordFor.id, input },
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
      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() =>
          deactivating &&
          action.mutate(
            { id: deactivating.id, action: 'deactivate' },
            {
              onSuccess: () => {
                toast.success(`${deactivating.name} deactivated and signed out everywhere`);
                setDeactivating(null);
              },
              onError,
            },
          )
        }
        title={`Deactivate ${deactivating?.name ?? 'this account'}?`}
        description={`${deactivating?.email ?? 'They'} will be signed out of every device and cannot sign in until you reactivate the account. Their venues and data stay as they are.`}
        confirmLabel="Deactivate"
        danger
        loading={action.isPending}
      />
    </div>
  );
}
