export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'crm.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

/** Replaces the token where it already lives (after a password change the server issues a new one). */
export function replaceToken(token: string) {
  setToken(token, localStorage.getItem(TOKEN_KEY) !== null);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export interface ListEnvelope<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * What the API said went wrong. `message` is written for the person using the app;
 * `code` lets a page react to a particular case (for example `bank_pending`);
 * `fields` holds per-field messages when a form was rejected.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field name to first message, for a form the server rejected. Nested fields use a dot: `admin.email`. */
  get fields(): Record<string, string> {
    const out: Record<string, string> = {};
    const details = this.details as { fieldErrors?: Record<string, string[]>; field?: string } | undefined;
    for (const [name, messages] of Object.entries(details?.fieldErrors ?? {})) {
      if (messages?.[0]) out[name] = messages[0];
    }
    if (details?.field) out[details.field] = this.message;
    return out;
  }
}

/** Pages people may be on without a session: a 401 there is an answer, not a reason to leave. */
const PUBLIC_PATHS = ['/login', '/register', '/invite', '/platform'];
const onPublicPage = () => PUBLIC_PATHS.some((path) => window.location.pathname.startsWith(path));

export async function readError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  return new ApiError(
    res.status,
    body?.error?.code ?? 'request_failed',
    body?.error?.message ?? `Request failed (${res.status})`,
    body?.error?.details
  );
}

/** Shared fetch wrapper: attaches the bearer token and centrally handles an ended session. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Sent without a token (signing in, an invite link): the server's own message is the answer.
    if (!token) throw await readError(res);
    clearToken();
    if (!onPublicPage()) window.location.href = '/login';
    throw new ApiError(401, 'session_expired', 'Session expired');
  }

  if (!res.ok) {
    const error = await readError(res);
    // Someone still on a password their admin chose may do nothing else until they replace it.
    if (error.code === 'password_change_required' && window.location.pathname !== '/set-password') {
      window.location.href = '/set-password';
    }
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
