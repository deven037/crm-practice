import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Contact } from '../../types';

export function useContacts(query = '') {
  return useQuery({
    queryKey: ['contacts', query],
    queryFn: () => apiFetch<ListEnvelope<Contact>>(`/contacts?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => apiFetch<Contact>(`/contacts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contact: Partial<Contact>) => apiFetch<Contact>('/contacts', { method: 'POST', body: JSON.stringify(contact) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Contact> & { id: string }) =>
      apiFetch<Contact>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.setQueryData(['contacts', contact.id], contact);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
