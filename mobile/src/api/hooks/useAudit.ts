import { useQuery } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { AuditEntry } from '../../types';

export function useAudit() {
  return useQuery({
    queryKey: ['audit', 'all'],
    queryFn: () => apiFetch<ListEnvelope<AuditEntry>>('/audit?pageSize=200'),
  });
}
