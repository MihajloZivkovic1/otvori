import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AnalyticsDto,
  AnalyticsRange,
  AvailabilityInput,
  CategoryDto,
  CreateCategoryInput,
  CreateItemInput,
  CreateTableInput,
  MenuItemDto,
  PaginatedDto,
  RestaurantDto,
  SuperadminListRestaurantsQuery,
  SuperadminRestaurantDto,
  SuperadminUpdateRestaurantInput,
  TableDto,
  UpdateCategoryInput,
  UpdateItemInput,
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
  qr: (rid: string, tableId: string, format: 'png' | 'svg') => ['qr', rid, tableId, format] as const,
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
