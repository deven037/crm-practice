import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Account } from '../../types';

export function useAccounts(query = '') {
  return useQuery({
    queryKey: ['accounts', query],
    queryFn: () => apiFetch<ListEnvelope<Account>>(`/accounts?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => apiFetch<Account>(`/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (account: Partial<Account>) => apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(account) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Account> & { id: string }) =>
      apiFetch<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.setQueryData(['accounts', account.id], account);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade: boolean }) =>
      apiFetch<void>(`/accounts/${id}?cascade=${cascade}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
