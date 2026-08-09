import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ListEnvelope } from '../client';
import { TaskItem } from '../../types';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => apiFetch<ListEnvelope<TaskItem>>('/tasks?pageSize=200'),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: Partial<TaskItem>) => apiFetch<TaskItem>('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<TaskItem> & { id: string }) =>
      apiFetch<TaskItem>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** Bulk reorder after a drag — one PUT per task, matching the web app's saveAll('tasks', …). */
export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tasks: TaskItem[]) =>
      Promise.all(tasks.map((t) => apiFetch<TaskItem>(`/tasks/${t.id}`, { method: 'PUT', body: JSON.stringify(t) }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
