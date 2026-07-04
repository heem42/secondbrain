import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Task, TaskList, TaskPriority } from './types';

// Server state lives in the TanStack Query cache — the web analog of the iOS
// GRDB store. Reads come from the cache; mutations invalidate to refetch.

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: () => apiFetch<TaskList[]>('/lists'),
  });
}

export function useTasks(listId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', listId],
    queryFn: () => apiFetch<Task[]>(`/tasks?listId=${listId}`),
    enabled: !!listId,
  });
}

export function useCreateTask(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      apiFetch<Task>('/tasks', {
        method: 'POST',
        // Client-generated UUID so the row is idempotent (§11).
        body: JSON.stringify({ id: crypto.randomUUID(), listId, title }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  });
}

export function useToggleTask(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) =>
      apiFetch<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: task.status === 'done' ? 'todo' : 'done',
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  });
}

export function useUpdateTask(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title: string; priority: TaskPriority }) =>
      apiFetch<Task>(`/tasks/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: input.title, priority: input.priority }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  });
}

export function useDeleteTask(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  });
}
