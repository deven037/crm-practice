import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { Product } from '../../types';

export function useProducts(query = '') {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => apiFetch<ListEnvelope<Product>>(`/products?pageSize=100${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => apiFetch<Product>(`/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Partial<Product>) =>
      apiFetch<Product>('/products', { method: 'POST', body: JSON.stringify(product) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Product> & { id: string }) =>
      apiFetch<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.setQueryData(['products', product.id], product);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

/** Used only for the pre-delete impact banner (how many leads/quotes reference this product) — the
 * server performs the actual unlink on DELETE, this is just read-only context for the confirm modal. */
export function useProductDependents(productId: string) {
  return useQuery({
    queryKey: ['products', productId, 'dependents'],
    queryFn: async () => {
      const [leadsRes, quotesRes] = await Promise.all([
        apiFetch<ListEnvelope<{ id: string; productId?: string | null }>>('/leads?pageSize=100'),
        apiFetch<ListEnvelope<{ id: string; lineItems: { productId: string }[] }>>('/quotes?pageSize=100'),
      ]);
      return {
        leadCount: leadsRes.data.filter((l) => l.productId === productId).length,
        quoteCount: quotesRes.data.filter((q) => q.lineItems.some((li) => li.productId === productId)).length,
      };
    },
    enabled: !!productId,
  });
}
