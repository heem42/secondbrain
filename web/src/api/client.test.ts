import { beforeEach, describe, expect, it, vi } from 'vitest';

// The client holds the access token in module scope, so each test re-imports a
// fresh copy after resetModules() to isolate that state.
async function freshClient() {
  vi.resetModules();
  return import('./client');
}

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function res(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function authHeaderOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit;
  return new Headers(init.headers).get('Authorization');
}

function urlOf(call: unknown[]): string {
  return call[0] as string;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('apiFetch', () => {
  it('sends credentials and no auth header before login', async () => {
    const { apiFetch } = await freshClient();
    fetchMock.mockResolvedValueOnce(res(200, [{ id: 'l1' }]));

    await apiFetch('/lists');

    const call = fetchMock.mock.calls[0];
    expect(urlOf(call)).toContain('/lists');
    expect((call[1] as RequestInit).credentials).toBe('include');
    expect(authHeaderOf(call)).toBeNull();
  });

  it('attaches the bearer token after login', async () => {
    const { login, apiFetch } = await freshClient();
    fetchMock.mockResolvedValueOnce(
      res(200, { accessToken: 'abc', refreshToken: 'r', user: { id: 'u1' } }),
    );
    await login('a@b.com', 'password123');

    fetchMock.mockResolvedValueOnce(res(200, []));
    await apiFetch('/lists');

    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe('Bearer abc');
  });

  it('returns undefined for a 204 (e.g. DELETE)', async () => {
    const { apiFetch } = await freshClient();
    fetchMock.mockResolvedValueOnce(res(204, null));
    await expect(apiFetch('/tasks/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the server message (array joined)', async () => {
    const { apiFetch, ApiError } = await freshClient();
    fetchMock.mockResolvedValueOnce(
      res(400, { message: ['title must be a string', 'listId must be a UUID'] }),
    );
    const err = await apiFetch('/tasks', { method: 'POST' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('title must be a string\nlistId must be a UUID');
  });
});

describe('401 → refresh → retry', () => {
  it('refreshes once and retries the original request with the new token', async () => {
    const { apiFetch } = await freshClient();
    fetchMock
      .mockResolvedValueOnce(res(401, null)) // 1: original GET → unauthorized
      .mockResolvedValueOnce(res(200, { accessToken: 'fresh' })) // 2: refresh
      .mockResolvedValueOnce(res(200, [{ id: 't1' }])); // 3: retry

    const data = await apiFetch<{ id: string }[]>('/tasks?listId=l1');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(fetchMock.mock.calls[1])).toContain('/auth/refresh');
    // the retry carries the refreshed token
    expect(authHeaderOf(fetchMock.mock.calls[2])).toBe('Bearer fresh');
    expect(data).toEqual([{ id: 't1' }]);
  });

  it('does not retry when the refresh itself fails', async () => {
    const { apiFetch } = await freshClient();
    fetchMock
      .mockResolvedValueOnce(res(401, null)) // original
      .mockResolvedValueOnce(res(401, null)); // refresh fails

    await expect(apiFetch('/lists')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2); // no third (retry) call
  });

  it('never triggers refresh for the auth endpoints themselves', async () => {
    const { login, ApiError } = await freshClient();
    fetchMock.mockResolvedValueOnce(res(401, { message: 'Invalid credentials' }));

    await expect(login('a@b.com', 'nope')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // login only; no refresh attempt
  });
});
