import { useAuth } from '@/stores/auth';
import type { ApiErrorBody, AuthTokens } from './types';

export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  /** Kein Bearer, kein Auto-Refresh (Login, Registrierung, Refresh). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

/** Tauscht den Refresh-Token gegen ein neues Paar (Rotation). Parallele Aufrufe teilen sich eine Anfrage. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const { refreshToken } = useAuth.getState();
  if (!refreshToken) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const tokens = await raw<AuthTokens>('POST', '/auth/refresh', { body: { refreshToken }, anonymous: true });
      useAuth.getState().setSession(tokens);
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) useAuth.getState().clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function raw<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = useAuth.getState().accessToken;
  if (!opts.anonymous && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Server nicht erreichbar.');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? res.statusText);
  }
  return data as T;
}

/** API-Aufruf mit Bearer-Token; bei 401 einmal Token erneuern und wiederholen. */
export async function api<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  if (!opts.anonymous && !useAuth.getState().accessToken && useAuth.getState().refreshToken) {
    await refreshSession();
  }
  try {
    return await raw<T>(method, path, opts);
  } catch (e) {
    if (!opts.anonymous && e instanceof ApiError && e.status === 401 && (await refreshSession())) {
      return raw<T>(method, path, opts);
    }
    if (!opts.anonymous && e instanceof ApiError && e.status === 401) useAuth.getState().clear();
    throw e;
  }
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>('GET', path, { signal });
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, { body });
