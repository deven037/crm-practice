import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Ticket, TicketPriority, TicketStatus } from '../../types';

export function useTickets(query = '') {
  return useQuery({
    queryKey: ['tickets', query],
    queryFn: () => apiFetch<ListEnvelope<Ticket>>(`/tickets?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => apiFetch<Ticket>(`/tickets/${id}`),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticket: Partial<Ticket>) => apiFetch<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(ticket) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tickets/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

function onTicketMutated(queryClient: ReturnType<typeof useQueryClient>, ticket: Ticket) {
  queryClient.invalidateQueries({ queryKey: ['tickets'] });
  queryClient.setQueryData(['tickets', ticket.id], ticket);
}

export function useTransitionTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      apiFetch<Ticket>(`/tickets/${id}/transition`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: (ticket) => onTicketMutated(queryClient, ticket),
  });
}

export function useSetTicketPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: TicketPriority }) =>
      apiFetch<Ticket>(`/tickets/${id}/priority`, { method: 'POST', body: JSON.stringify({ priority }) }),
    onSuccess: (ticket) => onTicketMutated(queryClient, ticket),
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      apiFetch<Ticket>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
    onSuccess: (ticket) => onTicketMutated(queryClient, ticket),
  });
}

/** Generic PUT — used for edit/delete-comment and attachments, which have no dedicated
 * endpoint (only create-comment/transition/priority do). */
export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Ticket> & { id: string }) =>
      apiFetch<Ticket>(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (ticket) => onTicketMutated(queryClient, ticket),
  });
}
