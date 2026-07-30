import { clearToken, getToken } from '../auth/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://crm-practice-api.onrender.com';

export interface ListEnvelope<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Called on every 401. There's no `window.location` on native, so instead of an imperative
 * redirect, this just flips shared auth state to `null` — AuthContext/RootNavigator react to
 * that state change and swap to the AuthStack, the native equivalent of a route redirect.
 */
let unauthorizedHandler: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

/** Shared fetch wrapper — attaches the bearer token and centrally handles 401 (expired/invalid session). */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    await clearToken();
    unauthorizedHandler?.();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
