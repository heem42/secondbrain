import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCreateTask, useTasks, useToggleTask } from './hooks';
import type { Task } from './types';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from './client';
const mockFetch = vi.mocked(apiFetch);

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

const sampleTask: Task = {
  id: 't1',
  listId: 'l1',
  createdBy: null,
  title: 'Buy milk',
  notes: null,
  status: 'todo',
  priority: 'none',
  dueAt: null,
  remindAt: null,
  recurrenceRule: null,
  completedAt: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTasks', () => {
  it('fetches tasks for the given list', async () => {
    mockFetch.mockResolvedValue([sampleTask]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTasks('l1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith('/tasks?listId=l1');
    expect(result.current.data).toEqual([sampleTask]);
  });

  it('is disabled (does not fetch) when no list is selected', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useTasks(undefined), { wrapper });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useCreateTask', () => {
  it('POSTs a task with a client id and invalidates the list cache', async () => {
    mockFetch.mockResolvedValue(sampleTask);
    const { wrapper, invalidate } = makeWrapper();

    const { result } = renderHook(() => useCreateTask('l1'), { wrapper });
    await act(async () => {
      result.current.mutate('Buy milk');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/tasks');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ listId: 'l1', title: 'Buy milk' });
    expect(typeof body.id).toBe('string'); // client-generated UUID
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', 'l1'] });
  });
});

describe('useToggleTask', () => {
  it('PATCHes the flipped status', async () => {
    mockFetch.mockResolvedValue({ ...sampleTask, status: 'done' });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useToggleTask('l1'), { wrapper });
    await act(async () => {
      result.current.mutate(sampleTask); // currently 'todo'
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/tasks/t1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'done' });
  });
});
