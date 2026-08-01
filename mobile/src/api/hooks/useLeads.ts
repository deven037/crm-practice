import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Account, Contact, Deal, DealStage, Lead } from '../../types';

export function useLeads(query = '') {
  return useQuery({
    queryKey: ['leads', query],
    queryFn: () => apiFetch<ListEnvelope<Lead>>(`/leads?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => apiFetch<Lead>(`/leads/${id}`),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lead: Partial<Lead>) => apiFetch<Lead>('/leads', { method: 'POST', body: JSON.stringify(lead) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Lead> & { id: string }) =>
      apiFetch<Lead>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.setQueryData(['leads', lead.id], lead);
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export interface ConvertLeadPayload {
  accountMode: 'new' | 'existing';
  existingAccountId?: string;
  accountName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createDeal: boolean;
  dealName?: string;
  dealAmount?: number;
  dealStage?: DealStage;
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ConvertLeadPayload & { id: string }) =>
      apiFetch<{ lead: Lead; account: Account; contact: Contact; deal?: Deal }>(`/leads/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ lead }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.setQueryData(['leads', lead.id], lead);
    },
  });
}
