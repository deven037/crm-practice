import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Deal, Quote, QuoteStatus } from '../../types';

export function useQuotes(query = '') {
  return useQuery({
    queryKey: ['quotes', query],
    queryFn: () => apiFetch<ListEnvelope<Quote>>(`/quotes?pageSize=200${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => apiFetch<Quote>(`/quotes/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quote: Partial<Quote>) => apiFetch<Quote>('/quotes', { method: 'POST', body: JSON.stringify(quote) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Quote> & { id: string }) =>
      apiFetch<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.setQueryData(['quotes', quote.id], quote);
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/quotes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });
}

/** Transition legality (QUOTE_TRANSITIONS) and the accept-auto-closes-linked-deal side
 * effect are both enforced server-side — this just calls it and syncs the cache. */
export function useTransitionQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      apiFetch<{ quote: Quote; deal?: Deal }>(`/quotes/${id}/transition`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: ({ quote }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.setQueryData(['quotes', quote.id], quote);
    },
  });
}
