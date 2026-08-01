import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Campaign } from '../../types';

export function useCampaigns(query = '') {
  return useQuery({
    queryKey: ['campaigns', query],
    queryFn: () => apiFetch<ListEnvelope<Campaign>>(`/campaigns?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => apiFetch<Campaign>(`/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaign: Partial<Campaign>) => apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(campaign) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Campaign> & { id: string }) =>
      apiFetch<Campaign>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.setQueryData(['campaigns', campaign.id], campaign);
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
