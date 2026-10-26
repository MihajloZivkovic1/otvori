import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AnalyticsDto,
  AnalyticsRange,
  AuditPageDto,
  CreateInviteInput,
  ElevationDto,
  JoinCodeDto,
  ListAuditQuery,
  RemovePinInput,
  SecurityDto,
  SetPinInput,
  TeamDto,
  UnlockInput,
  UpdateMemberInput,
  UpdateSecurityInput,
  AvailabilityInput,
  CategoryDto,
  CreateCategoryInput,
  CreateItemInput,
  CreateRestaurantInput,
  CreateTableInput,
  MenuItemDto,
  OrderDto,
  PaymentConfigDto,
  PosConfigDto,
  PosSyncPreviewDto,
  PosTableDto,
  PosTaxLabelDto,
  PosSyncResultDto,
  ApplyPosSyncInput,
  PaginatedDto,
  RestaurantDto,
  ServiceRequestDto,
  SseTokenDto,
  SuperadminListRestaurantsQuery,
  SuperadminRestaurantDto,
  SuperadminUpdateRestaurantInput,
  TableDto,
  UpdateCategoryInput,
  UpdateItemInput,
  UpdateOrderStatusInput,
  UpdatePaymentConfigInput,
  UpdatePosConfigInput,
  UpdateRestaurantInput,
  UpdateTableInput,
} from '@qr-menu/shared';
import { api, apiBlob, apiUpload } from './api';

export const keys = {
  restaurant: (rid: string) => ['restaurant', rid] as const,
  categories: (rid: string) => ['categories', rid] as const,
  items: (rid: string) => ['items', rid] as const,
  tables: (rid: string) => ['tables', rid] as const,
  analytics: (rid: string, range: AnalyticsRange) => ['analytics', rid, range] as const,
  orders: (rid: string) => ['orders', rid] as const,
  paymentConfig: (rid: string) => ['paymentConfig', rid] as const,
  posConfig: (rid: string) => ['posConfig', rid] as const,
  posTables: (rid: string) => ['posTables', rid] as const,
  posTaxLabels: (rid: string) => ['posTaxLabels', rid] as const,
  requests: (rid: string) => ['requests', rid] as const,
  qr: (rid: string, tableId: string, format: 'png' | 'svg') => ['qr', rid, tableId, format] as const,
  security: (rid: string) => ['security', rid] as const,
  team: (rid: string) => ['team', rid] as const,
  audit: (rid: string, query: Partial<ListAuditQuery>) => ['audit', rid, query] as const,
  superadminRestaurants: (query: Partial<SuperadminListRestaurantsQuery>) => ['superadmin', 'restaurants', query] as const,
};

export const base = (rid: string) => `/api/admin/restaurants/${rid}`;

/* ------------------------------------------------------------------ restaurant */

export function useRestaurant(rid: string, enabled = true) {
  return useQuery({ queryKey: keys.restaurant(rid), queryFn: () => api<RestaurantDto>(base(rid)), enabled });
}

function setRestaurant(client: QueryClient, restaurant: RestaurantDto) {
  client.setQueryData(keys.restaurant(restaurant.id), restaurant);
}

/** POST /api/admin/restaurants — a new venue owned by the signed-in user (Pro owners and superadmins only). */
export function useCreateRestaurant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRestaurantInput) =>
      api<RestaurantDto>('/api/admin/restaurants', { method: 'POST', body: input }),
    onSuccess: (restaurant) => setRestaurant(client, restaurant),
  });
}

export function useUpdateRestaurant(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRestaurantInput) => api<RestaurantDto>(base(rid), { method: 'PATCH', body: input }),
    onSuccess: (restaurant) => setRestaurant(client, restaurant),
  });
}

export function useUploadLogo(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: Blob) => apiUpload<RestaurantDto>(`${base(rid)}/logo`, file, 'logo.png'),
    onSuccess: (restaurant) => setRestaurant(client, restaurant),
  });
}

export function usePublishRestaurant(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<RestaurantDto>(`${base(rid)}/publish`, { method: 'POST' }),
    onSuccess: (restaurant) => setRestaurant(client, restaurant),
  });
}

export function useDeleteRestaurant(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(base(rid), { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: keys.restaurant(rid) });
      client.removeQueries({ queryKey: keys.categories(rid) });
      client.removeQueries({ queryKey: keys.items(rid) });
      client.removeQueries({ queryKey: keys.tables(rid) });
    },
  });
}

/* ------------------------------------------------------------------ categories */

export function useCategories(rid: string) {
  return useQuery({ queryKey: keys.categories(rid), queryFn: () => api<CategoryDto[]>(`${base(rid)}/categories`) });
}

export function useCreateCategory(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      api<CategoryDto>(`${base(rid)}/categories`, { method: 'POST', body: input }),
    onSuccess: (category) => {
      client.setQueryData<CategoryDto[]>(keys.categories(rid), (prev) => (prev ? [...prev, category] : [category]));
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
    },
  });
}

/** PATCH a category; `isHidden` flips are applied optimistically. */
export function useUpdateCategory(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      api<CategoryDto>(`${base(rid)}/categories/${id}`, { method: 'PATCH', body: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: keys.categories(rid) });
      const previous = client.getQueryData<CategoryDto[]>(keys.categories(rid));
      client.setQueryData<CategoryDto[]>(keys.categories(rid), (prev) =>
        prev?.map((c) => (c.id === id ? { ...c, ...input, name: input.name ?? c.name } : c)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.categories(rid), context.previous);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: keys.categories(rid) }),
  });
}

export function useDeleteCategory(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`${base(rid)}/categories/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.setQueryData<CategoryDto[]>(keys.categories(rid), (prev) => prev?.filter((c) => c.id !== id));
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => prev?.filter((i) => i.categoryId !== id));
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
      void client.invalidateQueries({ queryKey: keys.items(rid) });
    },
  });
}

export function useReorderCategories(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<CategoryDto[]>(`${base(rid)}/categories/reorder`, { method: 'PUT', body: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: keys.categories(rid) });
      const previous = client.getQueryData<CategoryDto[]>(keys.categories(rid));
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        const ordered = ids.map((id) => byId.get(id)).filter((c): c is CategoryDto => Boolean(c));
        const rest = previous.filter((c) => !ids.includes(c.id));
        client.setQueryData(
          keys.categories(rid),
          [...ordered, ...rest].map((c, index) => ({ ...c, sortOrder: index })),
        );
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(keys.categories(rid), context.previous);
    },
    onSuccess: (categories) => client.setQueryData(keys.categories(rid), categories),
  });
}

/* ------------------------------------------------------------------ items */

export function useItems(rid: string) {
  return useQuery({ queryKey: keys.items(rid), queryFn: () => api<MenuItemDto[]>(`${base(rid)}/items`) });
}

function bumpCategoryCount(client: QueryClient, rid: string, categoryId: string, delta: number) {
  client.setQueryData<CategoryDto[]>(keys.categories(rid), (prev) =>
    prev?.map((c) => (c.id === categoryId ? { ...c, itemCount: Math.max(0, c.itemCount + delta) } : c)),
  );
}

export function useCreateItem(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => api<MenuItemDto>(`${base(rid)}/items`, { method: 'POST', body: input }),
    onSuccess: (item) => {
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => (prev ? [...prev, item] : [item]));
      bumpCategoryCount(client, rid, item.categoryId, 1);
      void client.invalidateQueries({ queryKey: keys.items(rid) });
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
    },
  });
}

export function useUpdateItem(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateItemInput }) =>
      api<MenuItemDto>(`${base(rid)}/items/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (item) => {
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => prev?.map((i) => (i.id === item.id ? item : i)));
      void client.invalidateQueries({ queryKey: keys.items(rid) });
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
    },
  });
}

export function useDeleteItem(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`${base(rid)}/items/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      const item = client.getQueryData<MenuItemDto[]>(keys.items(rid))?.find((i) => i.id === id);
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => prev?.filter((i) => i.id !== id));
      if (item) bumpCategoryCount(client, rid, item.categoryId, -1);
      void client.invalidateQueries({ queryKey: keys.items(rid) });
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
    },
  });
}

/** Optimistic availability switch: the row flips immediately and rolls back if the API rejects it. */
export function useSetAvailability(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AvailabilityInput }) =>
      api<MenuItemDto>(`${base(rid)}/items/${id}/availability`, { method: 'PATCH', body: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: keys.items(rid) });
      const previous = client.getQueryData<MenuItemDto[]>(keys.items(rid));
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) =>
        prev?.map((item) =>
          item.id === id
            ? {
                ...item,
                isAvailable: input.available || Boolean(input.until),
                unavailableUntil: input.available ? null : input.until ? 'pending' : null,
                isEffectivelyAvailable: input.available,
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.items(rid), context.previous);
    },
    onSuccess: (item) => {
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => prev?.map((i) => (i.id === item.id ? item : i)));
    },
    onSettled: () => void client.invalidateQueries({ queryKey: keys.items(rid) }),
  });
}

export function useReorderItems(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<MenuItemDto[]>(`${base(rid)}/items/reorder`, { method: 'PUT', body: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: keys.items(rid) });
      const previous = client.getQueryData<MenuItemDto[]>(keys.items(rid));
      if (previous) {
        const position = new Map(ids.map((id, index) => [id, index]));
        client.setQueryData<MenuItemDto[]>(
          keys.items(rid),
          previous
            .map((item) => (position.has(item.id) ? { ...item, sortOrder: position.get(item.id)! } : item))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(keys.items(rid), context.previous);
    },
    onSuccess: (items) => client.setQueryData(keys.items(rid), items),
  });
}

export function useUploadItemImage(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: Blob }) =>
      apiUpload<MenuItemDto>(`${base(rid)}/items/${id}/image`, file, 'photo.jpg'),
    onSuccess: (item) => {
      client.setQueryData<MenuItemDto[]>(keys.items(rid), (prev) => prev?.map((i) => (i.id === item.id ? item : i)));
    },
  });
}

/* ------------------------------------------------------------------ tables */

export function useTables(rid: string) {
  return useQuery({ queryKey: keys.tables(rid), queryFn: () => api<TableDto[]>(`${base(rid)}/tables`) });
}

export function useCreateTable(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTableInput) => api<TableDto>(`${base(rid)}/tables`, { method: 'POST', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.tables(rid) }),
  });
}

export function useUpdateTable(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTableInput }) =>
      api<TableDto>(`${base(rid)}/tables/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.tables(rid) });
      void client.invalidateQueries({ queryKey: ['qr', rid] });
    },
  });
}

export function useDeleteTable(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`${base(rid)}/tables/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.setQueryData<TableDto[]>(keys.tables(rid), (prev) => prev?.filter((t) => t.id !== id));
      void client.invalidateQueries({ queryKey: keys.tables(rid) });
    },
  });
}

/** QR image as a Blob (the endpoints need the bearer token, so <img src> cannot load them directly). */
export function useQrBlob(rid: string, tableId: string, format: 'png' | 'svg', enabled = true) {
  return useQuery({
    queryKey: keys.qr(rid, tableId, format),
    queryFn: () => apiBlob(`${base(rid)}/tables/${tableId}/qr.${format}`),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    enabled,
  });
}

export const downloads = {
  qr: (rid: string, tableId: string, format: 'png' | 'svg') => apiBlob(`${base(rid)}/tables/${tableId}/qr.${format}`),
  qrSheet: (rid: string) => apiBlob(`${base(rid)}/tables/qr-sheet.pdf`),
};

/* ------------------------------------------------------------------ ordering */

/** Open orders plus today's (the API default). Polled only while the SSE stream is down. */
export function useOrders(rid: string, enabled = true, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: keys.orders(rid),
    queryFn: () => api<OrderDto[]>(`${base(rid)}/orders`),
    enabled,
    refetchInterval,
    staleTime: 5_000,
  });
}

export function useServiceRequests(rid: string, enabled = true, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: keys.requests(rid),
    queryFn: () => api<ServiceRequestDto[]>(`${base(rid)}/requests`),
    enabled,
    refetchInterval,
    staleTime: 5_000,
  });
}

/** Insert or replace one order in the cache (SSE events and mutation results); older updates never win. */
export function upsertOrder(client: QueryClient, rid: string, order: OrderDto): void {
  client.setQueryData<OrderDto[]>(keys.orders(rid), (prev) => {
    if (!prev) return [order];
    const index = prev.findIndex((o) => o.id === order.id);
    if (index < 0) return [...prev, order];
    if (prev[index]!.updatedAt > order.updatedAt) return prev;
    const next = [...prev];
    next[index] = order;
    return next;
  });
}

export function upsertRequest(client: QueryClient, rid: string, request: ServiceRequestDto): void {
  client.setQueryData<ServiceRequestDto[]>(keys.requests(rid), (prev) => {
    if (!prev) return [request];
    const index = prev.findIndex((r) => r.id === request.id);
    if (index < 0) return [...prev, request];
    if (prev[index]!.updatedAt > request.updatedAt) return prev;
    const next = [...prev];
    next[index] = request;
    return next;
  });
}

export function useUpdateOrderStatus(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrderStatusInput }) =>
      api<OrderDto>(`${base(rid)}/orders/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (order) => upsertOrder(client, rid, order),
    // A 409 means another phone got there first: reload the board.
    onError: () => void client.invalidateQueries({ queryKey: keys.orders(rid) }),
  });
}

/** PATCH /orders/:id/payment { paymentStatus: 'cash' } — the waiter took cash (Phase 9c). */
export function useMarkOrderCash(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<OrderDto>(`${base(rid)}/orders/${id}/payment`, { method: 'PATCH', body: { paymentStatus: 'cash' } }),
    onSuccess: (order) => upsertOrder(client, rid, order),
    onError: () => void client.invalidateQueries({ queryKey: keys.orders(rid) }),
  });
}

/* ------------------------------------------------------------------ payment configuration (owner) */

export function usePaymentConfig(rid: string) {
  return useQuery({ queryKey: keys.paymentConfig(rid), queryFn: () => api<PaymentConfigDto>(`${base(rid)}/payment-config`) });
}

export function useUpdatePaymentConfig(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePaymentConfigInput) => api<PaymentConfigDto>(`${base(rid)}/payment-config`, { method: 'PATCH', body: input }),
    onSuccess: (config) => {
      client.setQueryData(keys.paymentConfig(rid), config);
      void client.invalidateQueries({ queryKey: keys.restaurant(rid) });
    },
  });
}

export function useTestPaymentConnection(rid: string) {
  return useMutation({
    mutationFn: () => api<{ ok: boolean; message: string }>(`${base(rid)}/payment-config/test`, { method: 'POST', body: {} }),
  });
}

/* ------------------------------------------------------------------ POS integration (Phase 9d) */

export function usePosConfig(rid: string) {
  return useQuery({ queryKey: keys.posConfig(rid), queryFn: () => api<PosConfigDto>(`${base(rid)}/pos-config`) });
}

export function useUpdatePosConfig(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePosConfigInput) => api<PosConfigDto>(`${base(rid)}/pos-config`, { method: 'PATCH', body: input }),
    onSuccess: (config) => {
      client.setQueryData(keys.posConfig(rid), config);
      void client.invalidateQueries({ queryKey: keys.restaurant(rid) });
    },
  });
}

export function useTestPosConnection(rid: string) {
  return useMutation({ mutationFn: () => api<{ ok: boolean; message: string }>(`${base(rid)}/pos-config/test`, { method: 'POST', body: {} }) });
}

/** The register's active tables (POS mode table mapping); only asked for once a provider is configured. */
export function usePosTables(rid: string, enabled: boolean) {
  return useQuery({ queryKey: keys.posTables(rid), queryFn: () => api<PosTableDto[]>(`${base(rid)}/pos/tables`), enabled, retry: false, staleTime: 60_000 });
}

/** The fiscal labels the venue's PFR accepts (tax label picker). */
export function usePosTaxLabels(rid: string, enabled: boolean) {
  return useQuery({ queryKey: keys.posTaxLabels(rid), queryFn: () => api<PosTaxLabelDto[]>(`${base(rid)}/pos/taxes`), enabled, retry: false, staleTime: 60_000 });
}

export function usePosSyncPreview(rid: string) {
  return useMutation({ mutationFn: () => api<PosSyncPreviewDto>(`${base(rid)}/pos/products`) });
}

export function useApplyPosSync(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyPosSyncInput) => api<PosSyncResultDto>(`${base(rid)}/pos/sync`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.items(rid) });
      void client.invalidateQueries({ queryKey: keys.categories(rid) });
    },
  });
}

/** POST /orders/:id/fiscal/retry — re-queue a failed fiscalisation. */
export function useRetryFiscal(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<OrderDto>(`${base(rid)}/orders/${id}/fiscal/retry`, { method: 'POST', body: {} }),
    onSuccess: (order) => upsertOrder(client, rid, order),
    onError: () => void client.invalidateQueries({ queryKey: keys.orders(rid) }),
  });
}

/** POST /orders/:id/fiscal/manual — the waiter issued the receipt at the register. */
export function useMarkFiscalManual(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<OrderDto>(`${base(rid)}/orders/${id}/fiscal/manual`, { method: 'POST', body: {} }),
    onSuccess: (order) => upsertOrder(client, rid, order),
    onError: () => void client.invalidateQueries({ queryKey: keys.orders(rid) }),
  });
}

export function useCompleteRequest(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ServiceRequestDto>(`${base(rid)}/requests/${id}`, { method: 'PATCH', body: { status: 'done' } }),
    onSuccess: (request) => upsertRequest(client, rid, request),
    onError: () => void client.invalidateQueries({ queryKey: keys.requests(rid) }),
  });
}

/** POST (block for 30 minutes) or DELETE (unblock) /tables/:id/block. */
export function useBlockTable(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) =>
      api<TableDto>(`${base(rid)}/tables/${id}/block`, { method: block ? 'POST' : 'DELETE' }),
    // The returned DTO is complete, so the row is replaced in place (no refetch, no flash of the old state).
    onSuccess: (table) => client.setQueryData<TableDto[]>(keys.tables(rid), (prev) => prev?.map((t) => (t.id === table.id ? table : t))),
  });
}

/** Short-lived token for the EventSource URL (it cannot send the bearer header). */
export function fetchSseToken(rid: string): Promise<SseTokenDto> {
  return api<SseTokenDto>(`${base(rid)}/sse-token`, { method: 'POST' });
}

/* ------------------------------------------------------------------ analytics */

export function useAnalytics(rid: string, range: AnalyticsRange) {
  return useQuery({
    queryKey: keys.analytics(rid, range),
    queryFn: () => api<AnalyticsDto>(`${base(rid)}/analytics?range=${range}`),
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ superadmin */

export function useSuperadminRestaurants(query: Partial<SuperadminListRestaurantsQuery>) {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.plan) params.set('plan', query.plan);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 50));
  return useQuery({
    queryKey: keys.superadminRestaurants(query),
    queryFn: () => api<PaginatedDto<SuperadminRestaurantDto>>(`/api/superadmin/restaurants?${params.toString()}`),
    placeholderData: (previous) => previous,
  });
}

export function useSuperadminUpdateRestaurant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SuperadminUpdateRestaurantInput }) =>
      api<SuperadminRestaurantDto>(`/api/superadmin/restaurants/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (restaurant) => {
      void client.invalidateQueries({ queryKey: ['superadmin', 'restaurants'] });
      void client.invalidateQueries({ queryKey: keys.restaurant(restaurant.id) });
    },
  });
}

/* ------------------------------------------------------------------ owner PIN, team, audit log (Phase 11) */

export function useSecurity(rid: string, enabled = true) {
  return useQuery({ queryKey: keys.security(rid), queryFn: () => api<SecurityDto>(`${base(rid)}/security`), enabled });
}

function setSecurity(client: QueryClient, rid: string, security: SecurityDto) {
  client.setQueryData(keys.security(rid), security);
  client.setQueryData<RestaurantDto>(keys.restaurant(rid), (prev) => (prev ? { ...prev, pinSet: security.pinSet } : prev));
}

export function useSetPin(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SetPinInput) => api<SecurityDto>(`${base(rid)}/security/pin`, { method: 'PUT', body: input }),
    onSuccess: (security) => setSecurity(client, rid, security),
  });
}

export function useRemovePin(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RemovePinInput) => api<SecurityDto>(`${base(rid)}/security/pin`, { method: 'DELETE', body: input }),
    onSuccess: (security) => setSecurity(client, rid, security),
  });
}

export function useUpdateSecurity(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSecurityInput) => api<SecurityDto>(`${base(rid)}/security`, { method: 'PATCH', body: input }),
    onSuccess: (security) => setSecurity(client, rid, security),
  });
}

/** POST …/security/unlock — the keypad (PIN) or the owner's password; the token goes to the elevation store. */
export function unlockVenue(rid: string, input: UnlockInput): Promise<ElevationDto> {
  return api<ElevationDto>(`${base(rid)}/security/unlock`, { method: 'POST', body: input });
}

/** POST …/security/extend — renews a `session` elevation while the app is open. */
export function extendElevation(rid: string): Promise<ElevationDto> {
  return api<ElevationDto>(`${base(rid)}/security/extend`, { method: 'POST' });
}

export function useTeam(rid: string, enabled = true) {
  return useQuery({ queryKey: keys.team(rid), queryFn: () => api<TeamDto>(`${base(rid)}/team`), enabled });
}

export function useCreateInvite(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) => api<TeamDto>(`${base(rid)}/team/invites`, { method: 'POST', body: input }),
    onSuccess: (team) => client.setQueryData(keys.team(rid), team),
  });
}

export function useRevokeInvite(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api<TeamDto>(`${base(rid)}/team/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: (team) => client.setQueryData(keys.team(rid), team),
  });
}

export function useCreateJoinCode(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<JoinCodeDto>(`${base(rid)}/team/join-code`, { method: 'POST' }),
    onSuccess: (joinCode) => client.setQueryData<TeamDto>(keys.team(rid), (prev) => (prev ? { ...prev, joinCode } : prev)),
  });
}

export function useRevokeJoinCode(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<TeamDto>(`${base(rid)}/team/join-code`, { method: 'DELETE' }),
    onSuccess: (team) => client.setQueryData(keys.team(rid), team),
  });
}

export function useUpdateMember(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string; input: UpdateMemberInput }) =>
      api<TeamDto>(`${base(rid)}/team/${membershipId}`, { method: 'PATCH', body: input }),
    onSuccess: (team) => client.setQueryData(keys.team(rid), team),
  });
}

export function useRemoveMember(rid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => api<TeamDto>(`${base(rid)}/team/${membershipId}`, { method: 'DELETE' }),
    onSuccess: (team) => client.setQueryData(keys.team(rid), team),
  });
}

export function useAuditLog(rid: string, query: Partial<ListAuditQuery>, enabled = true) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return useQuery({
    queryKey: keys.audit(rid, query),
    queryFn: () => api<AuditPageDto>(`${base(rid)}/audit-log?${params.toString()}`),
    placeholderData: (previous) => previous,
    enabled,
  });
}
