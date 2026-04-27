/**
 * Tiny fetch wrapper that auto-attaches the Supabase JWT and surfaces
 * non-2xx responses as Errors with the response body.
 *
 * Used by every page in the admin app. Keeps the call sites short and
 * consistent — error handling is a single try/catch at the call site.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

async function withAuthHeader(client: SupabaseClient | null): Promise<HeadersInit> {
  if (!client) return {};
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseBody(response: Response): Promise<unknown> {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return await response.text();
}

export async function apiFetch<T = unknown>(
  url: string,
  init: RequestInit & { client?: SupabaseClient | null } = {},
): Promise<T> {
  const { client = null, headers: passedHeaders, ...rest } = init;
  const authHeaders = await withAuthHeader(client);
  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(passedHeaders ?? {}),
    },
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const error = new Error(
      typeof body === 'object' && body && 'detail' in body
        ? String((body as { detail?: unknown }).detail)
        : `Request failed with ${response.status}`,
    ) as ApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body as T;
}
