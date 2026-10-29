import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponseDto, ChangePasswordInput, MeDto, SessionDto, UpdateProfileInput } from '@qr-menu/shared';
import { api } from './api';

export const accountKeys = { sessions: ['account', 'sessions'] as const };

export function useUpdateProfile() {
  return useMutation({ mutationFn: (input: UpdateProfileInput) => api<MeDto>('/api/auth/me', { method: 'PATCH', body: input }) });
}

/** The answer is a fresh session (every other device is signed out); the caller stores it with `signIn`. */
export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api<AuthResponseDto>('/api/auth/change-password', { method: 'POST', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: accountKeys.sessions }),
  });
}

export function useSessions(enabled = true) {
  return useQuery({ queryKey: accountKeys.sessions, queryFn: () => api<SessionDto[]>('/api/auth/sessions'), enabled });
}

export function useRevokeSessions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId?: string) => api<SessionDto[]>(sessionId ? `/api/auth/sessions/${sessionId}` : '/api/auth/sessions', { method: 'DELETE' }),
    onSuccess: (sessions) => client.setQueryData(accountKeys.sessions, sessions),
  });
}
