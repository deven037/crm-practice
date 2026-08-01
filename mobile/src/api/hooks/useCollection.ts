import { useQuery } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';

/**
 * Generic read-only list fetch for screens (like Dashboard) that only need aggregate
 * counts across a resource, not full CRUD. Modules that need mutations get their own
 * dedicated hook file (see useProducts.ts) instead of this.
 */
export function useCollection<T>(resource: string) {
  return useQuery({
    queryKey: [resource, 'all'],
    queryFn: () => apiFetch<ListEnvelope<T>>(`/${resource}?pageSize=200`),
  });
}
