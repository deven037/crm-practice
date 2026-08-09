import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { User } from '../../types';

export function useUsers() {
  return useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => apiFetch<ListEnvelope<User>>('/users?pageSize=200'),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: Partial<User>) => apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(user) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<User> & { id: string }) =>
      apiFetch<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<User>(`/users/${id}/toggle-active`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

/** DELETE with no reassignTo — server responds 409 (has_owned_records, {leads,accounts,deals})
 * if the user owns records, which callers catch and re-call with reassignTo set. */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      apiFetch<void>(`/users/${id}${reassignTo ? `?reassignTo=${reassignTo}` : ''}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
