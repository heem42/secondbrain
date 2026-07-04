import type { AuthResponse, User } from './types';

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3000/api';

// The access token lives only in memory (ARCHITECTURE.md §6, web variant). The
// refresh token is an httpOnly cookie the browser sends automatically — it never
// touches JS. `credentials: 'include'` is what carries that cookie.
let accessToken: string | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function messageFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('\n');
    if (body.message) return body.message;
  } catch {
    /* non-JSON body */
  }
  return `Request failed (HTTP ${res.status})`;
}

async function request(
  path: string,
  options: RequestInit,
  isRetry = false,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(BASE_URL + path, {
    ...options,
    headers,
    credentials: 'include',
  });

  // On 401, refresh once (cookie) and retry — but never for the auth endpoints.
  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) {
      return request(path, options, true);
    }
  }
  return res;
}

/** Typed JSON request. Throws ApiError on non-2xx. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await request(path, options);
  if (!res.ok) throw new ApiError(res.status, await messageFrom(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- auth (talk to /auth/* directly; these set/clear the refresh cookie) ----

export async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(BASE_URL + '/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    accessToken = null;
    return false;
  }
  const data = (await res.json()) as { accessToken: string };
  accessToken = data.accessToken;
  return true;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await postAuth('/auth/login', { email, password });
  accessToken = data.accessToken;
  return data.user;
}

export async function signup(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const data = await postAuth('/auth/signup', { email, password, displayName });
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await fetch(BASE_URL + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } finally {
    accessToken = null;
  }
}

async function postAuth(
  path: string,
  body: Record<string, unknown>,
): Promise<AuthResponse> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await messageFrom(res));
  return (await res.json()) as AuthResponse;
}
