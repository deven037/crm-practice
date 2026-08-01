import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Deal } from '../../types';

export function useDeals() {
  return useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => apiFetch<ListEnvelope<Deal>>('/deals?pageSize=200'),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deals', id],
    queryFn: () => apiFetch<Deal>(`/deals/${id}`),
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deal: Partial<Deal>) => apiFetch<Deal>('/deals', { method: 'POST', body: JSON.stringify(deal) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}

/** Server applies autoCloseDate itself (comparing the deal's stored stage vs the new one),
 * so the client just sends the full updated deal — no need to replicate that rule here. */
export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Deal> & { id: string }) =>
      apiFetch<Deal>(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.setQueryData(['deals', deal.id], deal);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm?: boolean }) =>
      apiFetch<void>(`/deals/${id}${confirm ? '?confirm=DELETE' : ''}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
}
