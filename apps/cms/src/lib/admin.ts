import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  BulkTablesInput,
  BulkTablesResultDto,
  CopyMenuInput,
  CopyMenuResultDto,
  ImpersonationDto,
  MenuImportInput,
  MenuImportPreviewDto,
  MenuImportResultDto,
  OrderDto,
  PaginatedDto,
  SlugCheckDto,
  SuperadminActivityPageDto,
  SuperadminActivityQuery,
  SuperadminAddMemberInput,
  SuperadminAddMemberResultDto,
  SuperadminCreateRestaurantInput,
  SuperadminInviteInput,
  SuperadminListRestaurantsQuery,
  SuperadminListUsersQuery,
  SuperadminMemberDto,
  SuperadminRestaurantDetailDto,
  SuperadminRestaurantDto,
  SuperadminSearchDto,
  SuperadminSetPasswordInput,
  SuperadminUpdateMemberInput,
  SuperadminUpdateRestaurantInput,
  SuperadminUpdateUserInput,
  SuperadminUserDto,
  SuperadminUserLinkDto,
  SystemStatusDto,
  TeamInviteDto,
  WelcomeEmailInput,
  WelcomeEmailResultDto,
} from '@qr-menu/shared';
import { api } from './api';
import { impersonationStore } from './impersonation';
import { base, keys } from './queries';

/** Query keys of the superadmin area; `['admin']` invalidates all of it. */
export const adminKeys = {
  restaurants: (query: Partial<SuperadminListRestaurantsQuery>) => ['admin', 'restaurants', query] as const,
  restaurant: (id: string) => ['admin', 'restaurant', id] as const,
  users: (query: Partial<SuperadminListUsersQuery>) => ['admin', 'users', query] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  activity: (query: Partial<SuperadminActivityQuery>) => ['admin', 'activity', query] as const,
  system: ['admin', 'system'] as const,
  search: (q: string) => ['admin', 'search', q] as const,
  slug: (slug: string, restaurantId?: string) => ['admin', 'slug', slug, restaurantId ?? null] as const,
};

const ADMIN = '/api/superadmin';

function params(query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/* ------------------------------------------------------------------ restaurants */

export function useAdminRestaurants(query: Partial<SuperadminListRestaurantsQuery>, enabled = true) {
  return useQuery({
    queryKey: adminKeys.restaurants(query),
    queryFn: () => api<PaginatedDto<SuperadminRestaurantDto>>(`${ADMIN}/restaurants${params(query)}`),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useAdminRestaurant(id: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.restaurant(id),
    queryFn: () => api<SuperadminRestaurantDetailDto>(`${ADMIN}/restaurants/${id}`),
    enabled,
  });
}

function setDetail(client: QueryClient, detail: SuperadminRestaurantDetailDto) {
  client.setQueryData(adminKeys.restaurant(detail.id), detail);
  void client.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
  // The venue's own shell (if open as owner in another tab/route) sees the change on its next load.
  void client.invalidateQueries({ queryKey: keys.restaurant(detail.id) });
}

export function useAdminCreateRestaurant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SuperadminCreateRestaurantInput) => api<SuperadminRestaurantDetailDto>(`${ADMIN}/restaurants`, { method: 'POST', body: input }),
    onSuccess: (detail) => setDetail(client, detail),
  });
}

export function useAdminUpdateRestaurant(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SuperadminUpdateRestaurantInput) => api<SuperadminRestaurantDetailDto>(`${ADMIN}/restaurants/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (detail) => setDetail(client, detail),
  });
}

export function useAdminDeleteRestaurant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`${ADMIN}/restaurants/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: adminKeys.restaurant(id) });
      client.removeQueries({ queryKey: keys.restaurant(id) });
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

/** Live slug check for the wizard (debounced by the caller). */
export function useSlugCheck(slug: string, restaurantId?: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.slug(slug, restaurantId),
    queryFn: () => api<SlugCheckDto>(`${ADMIN}/slug-check${params({ slug, restaurantId })}`),
    enabled: enabled && slug.length > 0,
    staleTime: 30_000,
  });
}

/** POST …/impersonate — the caller stores the token (so an abandoned request never revives a session). */
export function impersonate(restaurantId: string): Promise<ImpersonationDto> {
  return api<ImpersonationDto>(`${ADMIN}/restaurants/${restaurantId}/impersonate`, { method: 'POST', body: {} });
}

/** Fetch and store: from now on the venue's routes carry the impersonation token. */
export async function openAsOwner(restaurantId: string): Promise<ImpersonationDto> {
  const dto = await impersonate(restaurantId);
  impersonationStore.setFromDto(dto);
  return dto;
}

/* ------------------------------------------------------------------ members */

function setMembers(client: QueryClient, restaurantId: string, members: SuperadminMemberDto[]) {
  client.setQueryData<SuperadminRestaurantDetailDto>(adminKeys.restaurant(restaurantId), (prev) =>
    prev ? { ...prev, members, memberCount: members.length, owner: prev.owner ?? (members.find((m) => m.role === 'owner') ? { id: members[0]!.userId, name: members[0]!.name, email: members[0]!.email } : null) } : prev,
  );
  void client.invalidateQueries({ queryKey: adminKeys.restaurant(restaurantId) });
  void client.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
  void client.invalidateQueries({ queryKey: ['admin', 'users'] });
}

export function useAdminAddMember(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SuperadminAddMemberInput) => api<SuperadminAddMemberResultDto>(`${ADMIN}/restaurants/${restaurantId}/members`, { method: 'POST', body: input }),
    onSuccess: (result) => setMembers(client, restaurantId, result.members),
  });
}

export function useAdminUpdateMember(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string; input: SuperadminUpdateMemberInput }) =>
      api<SuperadminMemberDto[]>(`${ADMIN}/restaurants/${restaurantId}/members/${membershipId}`, { method: 'PATCH', body: input }),
    onSuccess: (members) => setMembers(client, restaurantId, members),
  });
}

export function useAdminRemoveMember(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => api<SuperadminMemberDto[]>(`${ADMIN}/restaurants/${restaurantId}/members/${membershipId}`, { method: 'DELETE' }),
    onSuccess: (members) => setMembers(client, restaurantId, members),
  });
}

function setInvites(client: QueryClient, restaurantId: string, invites: TeamInviteDto[]) {
  client.setQueryData<SuperadminRestaurantDetailDto>(adminKeys.restaurant(restaurantId), (prev) => (prev ? { ...prev, invites } : prev));
}

export function useAdminInvite(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SuperadminInviteInput) => api<TeamInviteDto[]>(`${ADMIN}/restaurants/${restaurantId}/invites`, { method: 'POST', body: input }),
    onSuccess: (invites) => setInvites(client, restaurantId, invites),
  });
}

export function useAdminRevokeInvite(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api<TeamInviteDto[]>(`${ADMIN}/restaurants/${restaurantId}/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: (invites) => setInvites(client, restaurantId, invites),
  });
}

/* ------------------------------------------------------------------ users */

export function useAdminUsers(query: Partial<SuperadminListUsersQuery>) {
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => api<PaginatedDto<SuperadminUserDto>>(`${ADMIN}/users${params(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: () => api<SuperadminUserDto>(`${ADMIN}/users/${id}`),
    enabled: Boolean(id),
  });
}

function setUser(client: QueryClient, user: SuperadminUserDto) {
  client.setQueryData(adminKeys.user(user.id), user);
  void client.invalidateQueries({ queryKey: ['admin', 'users'] });
  void client.invalidateQueries({ queryKey: ['admin', 'restaurant'] });
}

export function useAdminUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SuperadminUpdateUserInput }) => api<SuperadminUserDto>(`${ADMIN}/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (user) => setUser(client, user),
  });
}

export type UserAction = 'deactivate' | 'activate';
export function useAdminUserAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: UserAction }) => api<SuperadminUserDto>(`${ADMIN}/users/${id}/${action}`, { method: 'POST', body: {} }),
    onSuccess: (user) => setUser(client, user),
  });
}

export type UserLinkKind = 'reset-password' | 'magic-link';
export function useAdminUserLink() {
  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: UserLinkKind }) => api<SuperadminUserLinkDto>(`${ADMIN}/users/${id}/${kind}`, { method: 'POST', body: {} }),
  });
}

export function useAdminSetPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SuperadminSetPasswordInput }) => api<SuperadminUserDto>(`${ADMIN}/users/${id}/password`, { method: 'POST', body: input }),
    onSuccess: (user) => setUser(client, user),
  });
}

/* ------------------------------------------------------------------ activity, system, search */

export function useAdminActivity(query: Partial<SuperadminActivityQuery>) {
  return useQuery({
    queryKey: adminKeys.activity(query),
    queryFn: () => api<SuperadminActivityPageDto>(`${ADMIN}/activity${params(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useSystemStatus() {
  return useQuery({ queryKey: adminKeys.system, queryFn: () => api<SystemStatusDto>(`${ADMIN}/system`), refetchInterval: 30_000 });
}

export function useRetryPosJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api<OrderDto>(`${ADMIN}/system/pos-jobs/${jobId}/retry`, { method: 'POST', body: {} }),
    onSuccess: () => void client.invalidateQueries({ queryKey: adminKeys.system }),
  });
}

export function useAdminSearch(q: string) {
  return useQuery({
    queryKey: adminKeys.search(q),
    queryFn: () => api<SuperadminSearchDto>(`${ADMIN}/search${params({ q })}`),
    enabled: q.trim().length > 0,
    placeholderData: (previous) => previous,
    staleTime: 10_000,
  });
}

/* ------------------------------------------------------------------ onboarding helpers (tables, import, copy, welcome mail) */

export function useBulkTables(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkTablesInput) => api<BulkTablesResultDto>(`${base(restaurantId)}/tables/bulk`, { method: 'POST', body: input }),
    onSuccess: (result) => {
      client.setQueryData(keys.tables(restaurantId), result.tables);
      void client.invalidateQueries({ queryKey: adminKeys.restaurant(restaurantId) });
      void client.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
    },
  });
}

/** Parses the spreadsheet on the server (CSV or XLSX) and returns the preview with per-row errors. */
export function useMenuImportPreview(restaurantId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file, file.name);
      return api<MenuImportPreviewDto>(`${base(restaurantId)}/menu/import/preview`, { method: 'POST', body: form });
    },
  });
}

export function useMenuImport(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MenuImportInput) => api<MenuImportResultDto>(`${base(restaurantId)}/menu/import`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.categories(restaurantId) });
      void client.invalidateQueries({ queryKey: keys.items(restaurantId) });
      void client.invalidateQueries({ queryKey: adminKeys.restaurant(restaurantId) });
      void client.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
    },
  });
}

export function useCopyMenu(restaurantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyMenuInput) => api<CopyMenuResultDto>(`${ADMIN}/restaurants/${restaurantId}/menu/copy`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.categories(restaurantId) });
      void client.invalidateQueries({ queryKey: keys.items(restaurantId) });
      void client.invalidateQueries({ queryKey: adminKeys.restaurant(restaurantId) });
      void client.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
    },
  });
}

export function useWelcomeEmail(restaurantId: string) {
  return useMutation({
    mutationFn: (input: WelcomeEmailInput) => api<WelcomeEmailResultDto>(`${ADMIN}/restaurants/${restaurantId}/welcome-email`, { method: 'POST', body: input }),
  });
}

/** The spreadsheet template URL (same-origin or VITE_API_URL); the browser downloads it with the bearer token via apiBlob. */
export const MENU_TEMPLATE_PATH = (restaurantId: string, format: 'csv' | 'xlsx') => `${base(restaurantId)}/menu/import/template.${format}`;
